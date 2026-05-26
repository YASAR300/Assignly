import os
import sys
import shutil

# Make sure we can import from backend
sys.path.append(os.path.dirname(__file__))

from PIL import Image
from jobs import remove_background, generate_background_via_api, composite_images

def generate_samples():
    ref_image_path = r"C:\Users\Yasar\.gemini\antigravity-ide\brain\b7c5f5d0-09ed-46bf-a885-9095784b7869\pearl_jewelry_ref_1779721990408.png"
    if not os.path.exists(ref_image_path):
        print(f"Error: Reference image not found at {ref_image_path}")
        return
        
    output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "generated_samples"))
    os.makedirs(output_dir, exist_ok=True)
    print(f"Output directory created: {output_dir}")
    
    # Copy original to output directory as reference
    shutil.copy(ref_image_path, os.path.join(output_dir, "original_reference.png"))
    
    # Read product bytes
    with open(ref_image_path, "rb") as f:
        img_bytes = f.read()
        
    print("Step 1: Removing background from jewelry photo...")
    product_alpha_png = remove_background(img_bytes)
    product_alpha_png.save(os.path.join(output_dir, "extracted_product.png"))
    print("Product foreground extracted and saved!")
    
    # 8 Variations definitions
    variations = [
        ("white_background", "white_background.jpg", "Elegant solid white backdrop"),
        ("theme_marble", "theme_marble.jpg", "Jewelry resting on premium white marble surface"),
        ("theme_velvet", "theme_velvet.jpg", "Jewelry on luxury velvet folds"),
        ("creative_sunset", "creative_sunset.jpg", "Jewelry on golden beach sand at sunset"),
        ("creative_forest", "creative_forest.jpg", "Jewelry on green moss in misty forest"),
        ("model_front", "model_front.jpg", "Fashion model wearing jewelry front portrait shot"),
        ("model_side", "model_side.jpg", "Fashion model wearing jewelry side profile 45 degree shot"),
        ("model_closeup", "model_closeup.jpg", "Close up jewelry presentation on female neck skin")
    ]
    
    for type_id, filename, desc in variations:
        print(f"\nProcessing variation: {type_id} ({desc})...")
        try:
            # 1. Generate/Load background
            bg_img = generate_background_via_api(desc + ", professional commercial lighting, 8k resolution, crisp photorealistic focus", type_id)
            
            # 2. Composite
            composed_img = composite_images(bg_img, product_alpha_png, type_id)
            
            # 3. Save
            save_path = os.path.join(output_dir, filename)
            composed_img.save(save_path, "JPEG", quality=95)
            print(f"Saved: {save_path}")
        except Exception as e:
            print(f"Error generating {type_id}: {str(e)}")
            
    print("\nAll 8 sample images generated successfully in /generated_samples!")

if __name__ == "__main__":
    generate_samples()
