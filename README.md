# Drive  
A cloud-file-management frontend built with [Next.js](https://nextjs.org) + S3-compatible storage (e.g., AWS S3, Cloudflare R2, Tebi) + custom auth & sharing.

## 🚀 Project Overview  
This project enables you to:  
- Upload files (single + multipart) into one or more S3 buckets.  
- Maintain folder/directory structures across one or multiple buckets.  
- Reference and manage files in a database (metadata, folder path, bucket info, sharing links).  
- Support remote uploads (e.g., fetch from a URL and store into S3).  
- Authenticate users via a custom authentication service (e.g., `auth.kapil.app`).  
- Share files via links, control permissions, handle user/accounts.  
- Be flexible: multiple buckets, multi-tenant, remote upload, multi-part upload support for large files.

## ✅ Key Features  
- Built on **Next.js (App Router)** with React components and SSR/CSR as needed.  
- Multipart upload support (for large files) using S3 APIs (or compatible).  
- Multiple S3 buckets support — you can configure many buckets, map folders to buckets.  
- Folder/folder-structure support (nested folders) across buckets.  
- Remote upload support: provide a URL to download from and store into your S3 bucket.  
- File sharing: generate shareable links, control access (public/private), optionally link to auth.  
- Custom authentication: relies on `auth.kapil.app` (or your own) to authorize users.  
- Clean UI + good UX for uploads, file management, folder navigation.  
- Metadata stored to track files: bucket name, path, size, user owner, upload date, etc.  
- Good foundation for building a “Drive-like” experience (think Google Drive / Dropbox style) with custom backend.

## 📦 Getting Started

### Prerequisites  
- Node.js (recommend version ≥ 16)  
- Access to one or more S3-compatible buckets (AWS S3, Cloudflare R2, Tebi, etc.)  
- Database for metadata (PostgreSQL, MySQL, etc)  
- An authentication service set up (e.g., i am using `auth.kapil.app`)  
- Environment variables configured (see .env.example).

### Installation  
```bash
git clone https://github.com/heykapil/drive.git
cd drive
npm install     # or yarn / pnpm  
