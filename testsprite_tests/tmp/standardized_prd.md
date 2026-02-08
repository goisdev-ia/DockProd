# Standardized PRD - PickProd

## Project Overview
PickProd is a productivity management system for logistics and separation operations. It tracks employee performance, calculates bonuses based on productivity metrics (KG/h, Vol/h, Plt/h), and manages operational discounts (errors, absences, etc.).

## Tech Stack
- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Shadcn UI, Recharts.
- **Backend:** Supabase (PostgreSQL, Auth, SSR).
- **Utilities:** XLSX, ExcelJS, Zod, React Hook Form.

## Core Features

### 1. Authentication & Access Control
- **Login/Registration:** Secure authentication via Supabase Auth.
- **Role-Based Access Control (RBAC):** Three user levels: `novo` (pending), `colaborador` (viewer), `admin` (full access).
- **Route Protection:** Middleware-based protection for dashboard routes.

### 2. Analytical Dashboard
- **KPI Cards:** Real-time display of Total Productivity (R$), Achievement %, Total Loads, Total Orders, Tonnage (KG), Volume, Pallets, and Average Time.
- **Interactive Charts:**
    - **Temporal Evolution:** Area chart showing productivity over time.
    - **Performance by Employee/Branch:** Bar and radar charts for financial and volume comparisons.
    - **Top Clients:** Area chart identifying high-volume clients.
- **Rankings:** Top 3 tables for various metrics.
- **Dynamic Filters:** Filter by branch, period, employee, load, invoice, client, network, city, state, product, and family.

### 3. Data Upload
- **Excel Import:** Support for `.xlsx` files with automatic column detection.
- **Validation:** Automatic validation of branches and mandatory fields.
- **Preview:** Data preview before database persistence.
- **Duplicity Prevention:** Prevention of duplicate records based on Load-Client ID.

### 4. Productivity Management
- **Operational Control:** Detailed control of each load.
- **Employee Assignment:** Linking employees to loads/invoices.
- **Time Tracking:** Start/end time registration for automatic efficiency calculation.
- **Error Logging:** Registration of separation or delivery errors.

### 5. Discount Management
- **Automated Rules:**
    - Unjustified Absence: 100% discount.
    - Vacation: 100% discount.
    - Warning: 50% discount per occurrence.
    - Suspension: 100% discount per occurrence.
    - Medical Certificate: Progressive scale (25% to 100%).
- **Monthly History:** Records per employee/month/year.

### 6. Closing & Results
- **Bonus Calculation:**
    - 50% based on KG/h.
    - 30% based on Vol/h.
    - 20% based on Plt/h.
- **Final Settlement:** Application of discounts and errors to calculate final monthly bonus.

### 7. System Administration
- **Employee Management:** CRUD for employees, branches, and roles.
- **User Management:** Admin panel for managing user roles, branches, and account status.
- **Business Rules:** Dynamic configuration of calculation rules.

## Security Requirements
- **Row Level Security (RLS):** Enabled on all sensitive tables in Supabase.
- **Isolated Access:** Branch-based data isolation where applicable.
- **Secure Credentials:** No hardcoded secrets; environment variables managed via Vercel/Supabase.
