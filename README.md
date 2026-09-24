# 🏏 UniBox League 2026 - Box Cricket Tournament Platform

An enterprise-grade, real-time **Box Cricket Tournament Portal & Admin Command Center** built for university inter-department leagues. Features live **Supabase PostgreSQL database integration**, cryptographic salted password hashing, live athlete profile generation, document proof viewing, and coordinator administration controls.

![UniBox League](https://img.shields.io/badge/Status-Active-brightgreen)
![Database](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E)
![Styling](https://img.shields.io/badge/CSS-Tailwind%20CSS%20v4-38B2AC)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## 🌟 Key Features

### 👤 Athlete Portal (`index.html`)
- **Interactive Registration**: Multi-field registration with Full Name, Department (B.Tech, BCA, BBA, MCA, MBA), Enrollment ID, Email, Gender, Playing Role, and Sports Certificate proof.
- **Athlete Headshot Upload**: Live crop/upload preview for student photo identification (`w-32 h-32`).
- **Cryptographic Authentication**: Salted SHA-256 password hashing via browser's native **Web Crypto API** before database storage. Plaintext passwords are never stored.
- **Dynamic Clearance Status**: Displays live coordinator decisions (`Approved`, `Pending Approval`, or `Rejected`) directly on the athlete credentials table.
- **Document Viewer**: Integrated viewer modal for uploaded certificate proofs (JPG, PNG, PDF) with download options.
- **Zero-Flicker Session Restoration**: Instant `<head>` pre-render check and two-phase profile hydration so page refreshes never flash the home page.

### 🛡️ Admin Command Center (`admin/`)
- **Restricted Access Portal (`admin/login.html`)**: Separate coordinator authentication protected by database credentials with instant route guards.
- **Real-Time KPIs**: Counters for Total Athletes, Approved/Verified, Pending Clearance, and Active Competing Branches.
- **Multi-Filter Toolbar**: Filter by Name, Enrollment, Email, Department, Playing Role, and Clearance Status.
- **Master Roster Management**:
  - One-click inline **Approve** and **Reject** controls.
  - Detailed **Athlete Inspection Modal** with full-size photo and certificate inspection.
  - Safe **Delete** action synced with Supabase PostgreSQL.
- **Export & Print**: One-click **Export to CSV** and formatted **Print Sheet** for matchday coordinators.

---

## 📂 Project Architecture

```
boxcricket/
├── admin/
│   ├── index.html        # Admin Command Center UI
│   ├── admin.js          # Admin controller logic & roster management
│   └── login.html        # Coordinator restricted login portal
├── dist/
│   └── output.css        # Compiled Tailwind CSS v4 bundle
├── src/
│   └── input.css         # Tailwind v4 source stylesheet
├── index.html            # Public landing page & athlete dashboard
├── script.js             # Athlete portal logic & session controller
├── supabaseClient.js     # Supabase client SDK & database helper methods
├── supabase_schema.sql   # PostgreSQL table schemas, RLS policies & indexes
├── package.json          # Build scripts & Tailwind CLI configuration
└── .gitignore            # Git ignore patterns
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js (v18 or higher recommended)
- A browser with modern JavaScript support

### 2. Installation
Clone the repository and install development dependencies:
```bash
git clone <your-repository-url>
cd boxcricket
npm install
```

### 3. Rebuild Tailwind CSS (Optional / Dev)
```bash
npm run build:css
```

### 4. Database Setup (Supabase)
1. Create a free project at [Supabase](https://supabase.com).
2. Go to **SQL Editor** -> **New Query**.
3. Copy the script from `supabase_schema.sql` and click **Run**.
4. Configure your project credentials in `supabaseClient.js`:
   ```javascript
   const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
   const SUPABASE_ANON_KEY = 'YOUR_PUBLISHABLE_ANON_KEY';
   ```

### 5. Launch
Open `index.html` with VS Code **Live Server** (or any static HTTP server):
- Athlete Portal: `http://localhost:5500/index.html`
- Admin Panel: `http://localhost:5500/admin/index.html` (Authorized coordinators only)

---

## 🔒 Security
- **Salted SHA-256 Hashing**: Passwords encrypted using browser Web Crypto API before leaving the client.
- **Row Level Security (RLS)**: PostgreSQL tables protected with strict role and operation policies.
- **Route Guards**: Immediate client-side routing blocks unauthenticated visitors from the admin control center.

