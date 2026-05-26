# Assignly — AI Studio for Jewelry Photography

> **AI-powered task management platform for professional jewelry photography.**  
> Admins create and assign photo tasks. Team members enter the **AI Studio** to generate exactly **8 professional product images** per task — backgrounds are AI-generated while the product stays pixel-perfect consistent across all shots.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![Flask](https://img.shields.io/badge/Flask-3.x-green?logo=flask)](https://flask.palletsprojects.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com)
[![Pollinations AI](https://img.shields.io/badge/AI-Pollinations.AI-ff6b35)](https://pollinations.ai)

---

## ✨ Key Features

| Feature | Detail |
|---|---|
| **Role-based access** | Admin (create / assign / review) · User (AI Studio generator) |
| **AI Image Generation** | Pollinations.AI (Flux) → HuggingFace → **Sandbox Mode** fallback chain |
| **Background Removal** | `rembg` (onnxruntime) for clean foreground extraction; smart PIL fallback |
| **PIL Compositing** | Professional drop-shadow, smart scaling & centering per shot type |
| **8 mandatory variations** | 1 white BG · 2 themed · 2 creative · 3 human model angles |
| **Email Notifications** | Brevo SMTP — assignment, submission, acceptance, revision, invite |
| **Kanban Dashboard** | 6-column Kanban with real-time job polling & lightbox image viewer |
| **Rate Limiting** | 100 req/min general · 10 AI generations/hr per user |
| **Audit Logs** | Every action written to `audit_logs` table with full details |
| **Background Jobs** | `ThreadPoolExecutor` async generation with live progress polling |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│   Next.js 16 · TypeScript · Supabase Auth · react-hot-toast    │
└────────────────────────┬───────────────────────────────────────┘
                         │ REST API (fetch)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FLASK BACKEND (Python)                        │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  app.py     │  │  jobs.py     │  │  email_utils.py        │ │
│  │  Routes     │  │  Background  │  │  Brevo SMTP Templates  │ │
│  │  Auth       │  │  Generation  │  │  HTML emails           │ │
│  │  Rate Limit │  │  Pipeline    │  └────────────────────────┘ │
│  └──────┬──────┘  └──────┬───────┘                             │
│         │                │                                      │
│  ┌──────▼──────┐  ┌──────▼───────────────────────────────────┐│
│  │  models.py  │  │  AI Generation Pipeline                   ││
│  │  SQLAlchemy │  │                                           ││
│  │  ORM        │  │  1. Download product image                ││
│  └──────┬──────┘  │  2. rembg background removal             ││
│         │         │  3. Pollinations.AI (Flux model) → BG    ││
│         │         │  4. PIL composite + drop shadow          ││
│         │         │  5. Save 800×800 JPEG to /static/        ││
│         │         │  6. DB record + Audit log                ││
│         │         └──────────────────────────────────────────┘│
└─────────┬───────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE (Cloud)                             │
│   PostgreSQL · Row Level Security · Auth (OAuth + Magic Link)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎨 AI Generation Pipeline

```
Product Photo (uploaded by Admin)
        │
        ▼
  [rembg / PIL]  ←── Background removal (transparent PNG)
        │
        ▼
 Transparent PNG  ──┐
                    │
  [Pollinations.AI] │    8 shot types:
  Flux model   ───► ├──► white_background       (pure studio shot)
                    ├──► theme_marble            (luxury marble backdrop)
  [HuggingFace]     ├──► theme_velvet            (rich velvet texture)
  SD v1-5 / SD 2.1  ├──► creative_sunset        (golden hour vibe)
  (if reachable)    ├──► creative_forest        (natural setting)
                    ├──► model_front             (human model, full view)
  [Sandbox Mode]    ├──► model_side              (profile angle)
  Unsplash URLs     └──► model_closeup           (close-up detail)
                              │
                              ▼
                    [PIL Compositor]
                    • Drop shadow (blurred alpha mask)
                    • Smart scale: 18%–70% depending on shot type
                    • Center + vertical offset per angle
                              │
                              ▼
                    800×800 JPEG → /static/generated/
                              │
                              ▼
                    DB record + Audit log entry
```

> **Critical constraint:** The product foreground is extracted **once** and composited onto every background — so the product looks exactly the same in all 8 images, ensuring brand consistency.

---

## 🗂 Project Structure

```
assignly/
├── backend/                        # Flask REST API
│   ├── app.py                      # Routes, auth, CORS, rate limiting
│   ├── jobs.py                     # AI generation pipeline + background jobs
│   ├── models.py                   # SQLAlchemy: User, Task, GeneratedImage, AuditLog
│   ├── config.py                   # Config loaded from .env
│   ├── email_utils.py              # Brevo SMTP + rich HTML email templates
│   ├── apply_migrations.py         # Runs SQL migrations against Supabase
│   ├── generate_samples_script.py  # Demo image batch generator
│   ├── static/
│   │   ├── uploads/                # Admin-uploaded product images
│   │   └── generated/              # AI-generated composite images
│   └── requirements.txt
│
├── frontend/                       # Next.js 16 App Router (TypeScript strict)
│   ├── src/app/
│   │   ├── page.tsx                # Landing / login page
│   │   ├── layout.tsx              # Root layout + Toaster
│   │   ├── globals.css             # Global styles
│   │   ├── auth/callback/          # Supabase OAuth callback handler
│   │   └── dashboard/
│   │       └── page.tsx            # Full dashboard + embedded AI Studio
│   └── src/lib/
│       └── supabase.ts             # Supabase client singleton
│
├── migrations/
│   ├── 01_init_schema.sql          # Core: users, tasks, RLS
│   └── 02_ai_studio.sql            # generated_images, audit_logs, updated RLS
│
├── generated_samples/              # 8 demo images from generate_samples_script.py
│   └── README.md
│
├── .env.example                    # Template for backend secrets
└── README.md
```

---

## 🔄 Task Status Flow

```
pending → assigned → in_progress → submitted → accepted
                                           ↘
                                    revision_requested → in_progress
```

| Status | Meaning |
|---|---|
| `pending` | Created but unassigned |
| `assigned` | Assigned to a team member |
| `in_progress` | User has started generating images |
| `submitted` | User submitted all 8 final images for review |
| `accepted` | Admin approved the submission |
| `revision_requested` | Admin sent back for changes |

---

## 📧 Email Notifications

| Trigger | Recipient | Content |
|---|---|---|
| Task assigned | Assignee | Title · description · product photo · due date · priority |
| Re-assigned | New assignee | Same as above |
| User submits 8 images | Admin | Review link + submitter name |
| Admin accepts | Assignee | Acceptance message + reviewer feedback |
| Admin requests revision | Assignee | Revision notes + feedback |
| Team member invited | Invitee | Invite link + inviter name |

---

## 🚀 Local Setup

### 1. Backend

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate          # Windows
# source venv/bin/activate       # macOS/Linux

pip install -r requirements.txt

# Copy and fill in your secrets
cp .env.example .env

# Apply DB migrations to Supabase
python apply_migrations.py

# Start API server (port 5000)
python app.py
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:3000` · Backend at `http://localhost:5000`.

---

## 🔑 Environment Variables

### `backend/.env`

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase PostgreSQL connection string |
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `SMTP_USER` | ✅ | Brevo SMTP login |
| `SMTP_PASSWORD` | ✅ | Brevo SMTP password |
| `SMTP_FROM` | ✅ | Sender email address |
| `FRONTEND_URL` | ✅ | Full frontend origin (for CORS & email links) |
| `BACKEND_URL` | ✅ | Public backend URL (for image URL construction) |
| `HF_API_TOKEN` | ⚙️ | Hugging Face token (fallback AI, optional) |
| `STABILITY_API_KEY` | ⚙️ | Stability AI key (premium, optional) |
| `REPLICATE_API_TOKEN` | ⚙️ | Replicate token (premium, optional) |

> **Note:** AI generation works out-of-the-box without any API keys via Pollinations.AI (free, no signup needed) and Sandbox Mode.

### `frontend/.env.local`

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_BACKEND_URL` | Backend API base URL |

---

## 📦 Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 16 · TypeScript (strict) · Lucide React · react-hot-toast |
| **Backend** | Python 3.11 · Flask 3 · SQLAlchemy · Flask-CORS |
| **AI / Image** | Pollinations.AI (Flux) · rembg · onnxruntime · Pillow |
| **Auth** | Supabase Auth (Google OAuth + Magic Link) |
| **Database** | Supabase PostgreSQL · Row Level Security |
| **Email** | Brevo SMTP · Rich HTML templates |
| **Deployment** | Render (backend) · Vercel (frontend) · Supabase (DB + Auth) |

---

## 🖼 Generated Samples

See [`/generated_samples/`](./generated_samples/) for 8 demo images generated from a pearl jewelry reference photo using the full pipeline (background removal → Pollinations.AI → PIL composite).

---

## 📄 License

MIT © 2026 Assignly
