import os
import uuid
import time
import requests
import io
from PIL import Image, ImageOps, ImageFilter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import traceback

# NOTE: `app` is NOT imported at the top level to avoid a circular import
# (app.py imports jobs.py, and jobs.py would import app.py).
# Instead, `app` is imported lazily inside run_image_generation_task() after
# the app module is fully initialized.
from models import db, Task, GeneratedImage, AuditLog

# Global job registry for tracking background progress
JOBS = {}
executor = ThreadPoolExecutor(max_workers=4)

# Create static directory to store generated images
STATIC_GENERATED_DIR = os.path.join(os.path.dirname(__file__), "static", "generated")
os.makedirs(STATIC_GENERATED_DIR, exist_ok=True)

# Curated High-Quality templates for Sandbox Mode (Royalty Free Unsplash & solid colors)
SANDBOX_TEMPLATES = {
    "white_background": "COLOR:#FFFFFF",
    "theme_marble": "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?q=80&w=800",
    "theme_velvet": "https://images.unsplash.com/photo-1599831777248-9072a7732a39?q=80&w=800",
    "creative_sunset": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800",
    "creative_forest": "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=800",
    "model_front": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=800",
    "model_side": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=800",
    "model_closeup": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=800"
}

def remove_background_floodfill(img: Image.Image, tolerance: int = 35) -> Image.Image:
    """
    Removes background using a highly robust multi-corner flood-fill algorithm.
    Works beautifully for uniform backgrounds of any color (white, black, green, etc.).
    """
    import collections
    img = img.convert("RGBA")
    w, h = img.size
    
    # Corners to start flood fill from
    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    
    pixels = img.load()
    visited = set()
    mask = Image.new("L", (w, h), 255)
    mask_pixels = mask.load()
    
    for start_x, start_y in corners:
        if (start_x, start_y) in visited:
            continue
            
        start_color = pixels[start_x, start_y]
        # Queue for BFS
        queue = collections.deque([(start_x, start_y)])
        visited.add((start_x, start_y))
        
        while queue:
            cx, cy = queue.popleft()
            
            # Make it transparent in mask
            mask_pixels[cx, cy] = 0
            
            # Check 4 neighbors
            for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in visited:
                    n_color = pixels[nx, ny]
                    # Calculate Euclidean distance in RGB
                    dist = ((n_color[0] - start_color[0]) ** 2 +
                            (n_color[1] - start_color[1]) ** 2 +
                            (n_color[2] - start_color[2]) ** 2) ** 0.5
                    
                    if dist <= tolerance:
                        visited.add((nx, ny))
                        queue.append((nx, ny))
                        
    # Apply the mask to the image alpha channel
    img.putalpha(mask)
    return img

def remove_background(img_data: bytes) -> Image.Image:
    """
    Extract product from original background using rembg library.
    Includes seamless fallback to chroma keying/alpha masking if rembg is not available or errors.
    """
    try:
        from rembg import remove
        print("[AI Studio] Extracting background using rembg...")
        output_data = remove(img_data)
        return Image.open(io.BytesIO(output_data))
    except Exception as e:
        print(f"[AI Studio] rembg extraction failed or not installed ({e}). Using advanced flood-fill fallback...")
        try:
            img = Image.open(io.BytesIO(img_data)).convert("RGBA")
            return remove_background_floodfill(img, tolerance=35)
        except Exception as fallback_err:
            print(f"[AI Studio] Advanced floodfill fallback also failed: {fallback_err}. Using absolute thresholding fallback.")
            try:
                img = Image.open(io.BytesIO(img_data)).convert("RGBA")
                # Basic thresholding to remove light-colored backgrounds
                datas = img.getdata()
                new_data = []
                for item in datas:
                    avg = (item[0] + item[1] + item[2]) / 3
                    variance = max(abs(item[0]-avg), abs(item[1]-avg), abs(item[2]-avg))
                    if avg > 230 and variance < 15:
                        new_data.append((255, 255, 255, 0))
                    else:
                        new_data.append(item)
                img.putdata(new_data)
                return img
            except Exception as final_err:
                print(f"[AI Studio] Absolute fallback failed: {final_err}")
                return Image.open(io.BytesIO(img_data)).convert("RGBA")

def generate_background_via_api(prompt: str, image_type: str) -> Image.Image:
    """
    Tries to generate a background using AI image generation APIs based on configured tokens.
    We STRICTLY prioritize Hugging Face Inference if HF_API_TOKEN is set.
    Falls back to Stability AI, Replicate, Pollinations, or curated beautiful templates (Sandbox Mode) if needed.
    """
    if image_type == "white_background":
        print("[AI Studio] Solid white background requested. Bypassing API and returning pure white background.")
        return Image.new("RGBA", (800, 800), (255, 255, 255, 255))

    hf_token = os.environ.get("HF_API_TOKEN")
    stability_key = os.environ.get("STABILITY_API_KEY")
    replicate_token = os.environ.get("REPLICATE_API_TOKEN")

    # ── HUGGING FACE INFERENCE (Strictly prioritize if token set) ──
    if hf_token:
        # Quick DNS check — verify we can reach the new Hugging Face router
        import socket
        try:
            socket.setdefaulttimeout(3)
            socket.getaddrinfo("router.huggingface.co", 443)
            hf_reachable = True
        except Exception:
            hf_reachable = False
            print("[AI Studio] router.huggingface.co domain unreachable.")

        if hf_reachable:
            HF_MODELS = [
                "black-forest-labs/FLUX.1-schnell",
                "black-forest-labs/FLUX.1-dev",
                "stabilityai/stable-diffusion-3.5-large"
            ]
            hf_headers = {
                "Authorization": f"Bearer {hf_token}",
                "Content-Type": "application/json",
            }
            payload = {
                "inputs": prompt,
                "parameters": {"width": 512, "height": 512},
                "options": {"wait_for_model": True},
            }
            for model_id in HF_MODELS:
                api_url = f"https://router.huggingface.co/hf-inference/models/{model_id}"
                print(f"[AI Studio] Querying Hugging Face — model: {model_id} via {api_url}")
                for attempt in range(8):
                    try:
                        response = requests.post(api_url, headers=hf_headers, json=payload, timeout=120)
                        if response.status_code == 200:
                            ct = response.headers.get("Content-Type", "")
                            if "image" in ct or len(response.content) > 5000:
                                print(f"[AI Studio] HF image received from {model_id} (attempt {attempt+1})")
                                return Image.open(io.BytesIO(response.content)).convert("RGBA")
                            break
                        if response.status_code == 503:
                            try:
                                wait_time = min(float(response.json().get("estimated_time", 20)), 30)
                            except Exception:
                                wait_time = 20
                            print(f"[AI Studio] HF model loading. Waiting {wait_time:.0f}s (attempt {attempt+1}/8)...")
                            time.sleep(wait_time)
                            continue
                        print(f"[AI Studio] HF {model_id} HTTP {response.status_code}: {response.text[:200]}")
                        break
                    except requests.exceptions.Timeout:
                        print(f"[AI Studio] HF {model_id} timeout attempt {attempt+1}, retrying...")
                        continue
                    except Exception as exc:
                        print(f"[AI Studio] HF {model_id} exception: {exc}")
                        break

    # ── STABILITY AI (Fallback) ───────────────────────
    if stability_key:
        try:
            print("[AI Studio] Querying Stability AI for background...")
            response = requests.post(
                "https://api.stability.ai/v1/generation/stable-diffusion-v1-6/text-to-image",
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Authorization": f"Bearer {stability_key}"
                },
                json={
                    "text_prompts": [{"text": prompt, "weight": 1.0}],
                    "cfg_scale": 7,
                    "height": 512,
                    "width": 512,
                    "samples": 1,
                    "steps": 30,
                },
                timeout=15
            )
            if response.status_code == 200:
                data = response.json()
                import base64
                img_bytes = base64.b64decode(data["artifacts"][0]["base64"])
                return Image.open(io.BytesIO(img_bytes))
            else:
                print(f"[AI Studio] Stability API Error: {response.text}")
        except Exception as e:
            print(f"[AI Studio] Stability AI call failed: {e}")

    # ── REPLICATE (Fallback) ──────────────────────────
    if replicate_token:
        try:
            print("[AI Studio] Querying Replicate for background...")
            response = requests.post(
                "https://api.replicate.com/v1/predictions",
                headers={
                    "Authorization": f"Token {replicate_token}",
                    "Content-Type": "application/json"
                },
                json={
                    "version": "da14632c0d654772071f5482d021f74c163baf758e14d398d404ea08af34e7a4",
                    "input": {
                        "prompt": prompt,
                        "width": 768,
                        "height": 768,
                        "refine": "expert_ensemble_refiner",
                        "scheduler": "K_EULER",
                        "num_inference_steps": 25
                    }
                },
                timeout=10
            )
            if response.status_code == 201:
                pred = response.json()
                get_url = pred["urls"]["get"]
                for _ in range(30):
                    time.sleep(1)
                    poll_resp = requests.get(get_url, headers={"Authorization": f"Token {replicate_token}"})
                    poll_data = poll_resp.json()
                    if poll_data["status"] == "succeeded":
                        img_url = poll_data["output"][0]
                        img_data = requests.get(img_url).content
                        return Image.open(io.BytesIO(img_data))
                    elif poll_data["status"] in ["failed", "canceled"]:
                        break
        except Exception as e:
            print(f"[AI Studio] Replicate call failed: {e}")

    # ── POLLINATIONS AI (Fallback) ────────────────────
    try:
        import urllib.parse
        encoded_prompt = urllib.parse.quote(prompt)
        pollinations_url = (
            f"https://image.pollinations.ai/prompt/{encoded_prompt}"
            f"?width=512&height=512&nologo=true&model=flux"
        )
        print(f"[AI Studio] Querying Pollinations.AI for background...")
        resp = requests.get(pollinations_url, timeout=90)
        if resp.status_code == 200 and len(resp.content) > 5000:
            print(f"[AI Studio] Pollinations.AI image received! ({len(resp.content)} bytes)")
            return Image.open(io.BytesIO(resp.content)).convert("RGBA")
        else:
            print(f"[AI Studio] Pollinations.AI failed: HTTP {resp.status_code}, bytes={len(resp.content)}")
    except Exception as e:
        print(f"[AI Studio] Pollinations.AI error: {e}")


    print(f"[AI Studio] Entering Sandbox Mode for background '{image_type}'...")
    template_val = SANDBOX_TEMPLATES.get(image_type, "COLOR:#FFFFFF")
    
    if template_val.startswith("COLOR:"):
        color_hex = template_val.split(":")[1]
        r = int(color_hex[1:3], 16)
        g = int(color_hex[3:5], 16)
        b = int(color_hex[5:7], 16)
        # Create solid color background
        return Image.new("RGBA", (800, 800), (r, g, b, 255))
    else:
        try:
            resp = requests.get(template_val, timeout=8)
            if resp.status_code == 200:
                return Image.open(io.BytesIO(resp.content)).convert("RGBA")
        except Exception as e:
            print(f"[AI Studio] Sandbox backdrop download failed: {e}. Generating procedural backdrop.")
        
        # Absolute fallback: procedural sunset gradient!
        base = Image.new("RGBA", (800, 800), (255, 255, 255, 255))
        from PIL import ImageDraw
        draw = ImageDraw.Draw(base)
        for y in range(800):
            # Orange to blue transition
            r = int(255 - (y / 800) * 100)
            g = int(140 + (y / 800) * 50)
            b = int(0 + (y / 800) * 200)
            draw.line([(0, y), (800, y)], fill=(r, g, b, 255))
        return base

def composite_images(bg_img: Image.Image, product_png: Image.Image, image_type: str) -> Image.Image:
    """
    Composes the extracted transparent product onto the background image.
    Applies professional visual sizing, centering, and realistic drop shadow matching the image type.
    """
    # Resize background to a standard size for consistency
    bg_img = bg_img.convert("RGBA").resize((800, 800), Image.Resampling.LANCZOS)
    
    # Calculate crop box of product to remove excess transparent padding
    bbox = product_png.getbbox()
    if bbox:
        product_png = product_png.crop(bbox)
        
    p_w, p_h = product_png.size
    
    # ── Calculate Scaling and Positioning ─────────────
    # Standard models or closeups might need smaller jewelry scaling, while standard studio shots need bigger products
    scale_factor = 0.70  # default
    offset_y = 0         # center
    
    if "model_closeup" in image_type:
        scale_factor = 0.40  # small jewelry fitting on neck/wrist
        offset_y = 60        # lower part of face/neck
    elif "model_" in image_type:
        scale_factor = 0.35  # smaller if full body or model front
        offset_y = 40
    elif "white_background" in image_type:
        scale_factor = 0.85  # standard large e-commerce shot

        
    # Resize product maintaining aspect ratio
    new_h = int(800 * scale_factor)
    new_w = int(p_w * (new_h / p_h))
    
    # Verify product isn't wider than background
    if new_w > 700:
        new_w = 700
        new_h = int(p_h * (new_w / p_w))
        
    product_resized = product_png.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    # Center coordinates
    x = (800 - new_w) // 2
    y = ((800 - new_h) // 2) + offset_y
    
    # ── Create Realistic Drop Shadow ──────────────────
    # Create shadow only if it's not a model wearing it (where shadow is handled naturally or needs skin blend)
    if "model" not in image_type and "white_background" not in image_type:
        # Extract alpha channel of product
        alpha = product_resized.split()[3]
        # Blur the alpha channel to create a soft shadow
        shadow_blur = alpha.filter(ImageFilter.GaussianBlur(15))
        # Create a black/dark grey shadow mask
        shadow = Image.new("RGBA", (new_w, new_h), (10, 10, 10, 140))
        # Composite shadow onto a transparent canvas sized 800x800
        shadow_canvas = Image.new("RGBA", (800, 800), (0, 0, 0, 0))
        # Paste shadow with blurred alpha offset slightly down and right
        shadow_canvas.paste(shadow, (x + 8, y + 15), mask=shadow_blur)
        
        # Combine background + shadow + product
        bg_img = Image.alpha_composite(bg_img, shadow_canvas)
    elif "white_background" in image_type:
        # Subtle light drop shadow for pure white backgrounds
        alpha = product_resized.split()[3]
        shadow_blur = alpha.filter(ImageFilter.GaussianBlur(10))
        shadow = Image.new("RGBA", (new_w, new_h), (40, 40, 40, 60))
        shadow_canvas = Image.new("RGBA", (800, 800), (0, 0, 0, 0))
        shadow_canvas.paste(shadow, (x + 3, y + 6), mask=shadow_blur)
        bg_img = Image.alpha_composite(bg_img, shadow_canvas)
        
    # Paste product onto background
    bg_img.paste(product_resized, (x, y), mask=product_resized)
    
    return bg_img.convert("RGB")

def upload_to_supabase_storage(bucket_name: str, file_path: str, file_bytes: bytes, content_type: str = "image/jpeg") -> str:
    """
    Uploads a file to a Supabase Storage bucket and returns its public URL.
    """
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    supabase_anon = os.environ.get("SUPABASE_ANON_KEY", "")
    
    if not supabase_url or not supabase_anon:
        raise Exception("Supabase configuration missing (SUPABASE_URL / SUPABASE_ANON_KEY)")
        
    upload_url = f"{supabase_url}/storage/v1/object/{bucket_name}/{file_path}"
    headers = {
        "Authorization": f"Bearer {supabase_anon}",
        "apikey": supabase_anon,
        "Content-Type": content_type
    }
    
    resp = requests.post(upload_url, headers=headers, data=file_bytes, timeout=30)
    if resp.status_code != 200:
        raise Exception(f"Supabase Storage upload failed: HTTP {resp.status_code} - {resp.text}")
        
    public_url = f"{supabase_url}/storage/v1/object/public/{bucket_name}/{file_path}"
    return public_url

def run_image_generation_task(task_id: str, image_type: str, prompt: str, job_id: str, user_id: str):
    """
    Executes the background image generation job.
    Includes background removal, AI background creation, PIL compositing, and Supabase database logging.
    """
    # Lazy import to avoid circular dependency: app.py imports jobs, jobs would import app
    from app import app as flask_app

    print(f"[Background Job] Starting job {job_id} for Task {task_id} ({image_type})...")
    JOBS[job_id]["progress"] = 15
    JOBS[job_id]["status"] = "processing"
    
    try:
        with flask_app.app_context():
            # 1. Load task details
            task = Task.query.get(task_id)
            if not task:
                raise Exception("Task not found.")
                
            if not task.product_image_url:
                raise Exception("Task does not have a product image uploaded.")
                
            JOBS[job_id]["progress"] = 30
            
            # 2. Download original product photo
            print(f"[Background Job] Downloading product image: {task.product_image_url}")
            response = requests.get(task.product_image_url, timeout=12)
            if response.status_code != 200:
                raise Exception(f"Failed to download product image. HTTP {response.status_code}")
                
            product_bytes = response.content
            JOBS[job_id]["progress"] = 45
            
            # 3. Perform background removal
            product_alpha_png = remove_background(product_bytes)
            JOBS[job_id]["progress"] = 65
            
            # 4. Generate background image via API or Sandbox
            bg_img = generate_background_via_api(prompt, image_type)
            JOBS[job_id]["progress"] = 80
            
            # 5. Composite product onto background
            final_img = composite_images(bg_img, product_alpha_png, image_type)
            JOBS[job_id]["progress"] = 90
            
            # 6. Save final image to local public directory and upload to Supabase Storage
            filename = f"gen_{task_id}_{image_type}_{uuid.uuid4().hex[:8]}.jpg"
            save_path = os.path.join(STATIC_GENERATED_DIR, filename)
            final_img.save(save_path, "JPEG", quality=92)
            
            # Read saved image bytes for upload
            with open(save_path, "rb") as f:
                image_bytes = f.read()
                
            try:
                print(f"[Background Job] Uploading generated image to Supabase Storage...")
                public_url = upload_to_supabase_storage("generated-images", filename, image_bytes)
                print(f"[Background Job] Composed image uploaded to Supabase: {public_url}")
            except Exception as upload_err:
                print(f"[Background Job] Supabase upload failed ({upload_err}). Falling back to local backend URL.")
                backend_url = os.environ.get("BACKEND_URL", "http://localhost:5000").rstrip("/")
                public_url = f"{backend_url}/static/generated/{filename}"
                print(f"[Background Job] Composed image saved locally: {public_url}")
            
            # 7. Write to database table 'generated_images'
            angle = None
            if "front" in image_type: angle = "front"
            elif "side" in image_type: angle = "side"
            elif "closeup" in image_type: angle = "closeup"
            
            # Clear any previously generated, non-final image of the SAME type to avoid cluttering
            existing = GeneratedImage.query.filter_by(task_id=task.id, image_type=image_type, is_final=False).first()
            if existing:
                db.session.delete(existing)
                
            gen_img = GeneratedImage(
                task_id=task.id,
                image_type=image_type,
                image_url=public_url,
                prompt_used=prompt,
                meta_data={
                    "engine": "Pillow-Compositor",
                    "width": 800,
                    "height": 800,
                    "generated_at": datetime.utcnow().isoformat(),
                    "sandbox": (os.environ.get("STABILITY_API_KEY") is None and 
                                os.environ.get("REPLICATE_API_TOKEN") is None and 
                                os.environ.get("HF_API_TOKEN") is None)
                },
                angle=angle,
                is_final=True # By default mark it as final or let users toggle it
            )
            db.session.add(gen_img)
            
            # 8. Create an Audit Log
            log = AuditLog(
                user_id=uuid.UUID(user_id) if user_id else None,
                action="GENERATE_IMAGE",
                target_type="image",
                target_id=gen_img.id,
                details={
                    "task_id": str(task.id),
                    "image_type": image_type,
                    "prompt": prompt,
                    "sandbox": gen_img.meta_data["sandbox"]
                }
            )

            db.session.add(log)
            db.session.commit()
            
            JOBS[job_id]["progress"] = 100
            JOBS[job_id]["status"] = "success"
            JOBS[job_id]["result"] = gen_img.to_dict()
            print(f"[Background Job] Job {job_id} successfully completed!")
            
    except Exception as e:
        db.session.rollback()
        error_msg = str(e)
        print(f"[Background Job] Job {job_id} failed with error: {error_msg}")
        traceback.print_exc()
        JOBS[job_id]["status"] = "failed"
        JOBS[job_id]["error"] = error_msg

def start_background_generation(task_id: str, image_type: str, prompt: str, user_id: str) -> str:
    """
    Spawns and queues the background image generation task.
    Returns the unique job_id.
    """
    job_id = f"job_{uuid.uuid4().hex[:12]}"
    JOBS[job_id] = {
        "status": "pending",
        "progress": 0,
        "result": None,
        "error": None,
        "started_at": datetime.utcnow().isoformat()
    }
    
    # Spawn thread asynchronously using ThreadPoolExecutor
    executor.submit(run_image_generation_task, task_id, image_type, prompt, job_id, user_id)
    return job_id
