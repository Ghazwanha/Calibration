# Ghazwan Reference Calibration — Source Export

نسخة كاملة من ملفات المصدر للموقع، جاهزة لوضعها في مستودع GitHub.
تاريخ التصدير: 2026-10-04
Source commit: a88f642882d0df91e63bd7402366e40f6bb908b7

## الرفع على GitHub
1. فك ضغط الملف.
2. أنشئ مستودعاً جديداً باسم ghazwan-reference-calibration.
3. ارفع محتويات مجلد المشروع، وليس ملف ZIP نفسه. احتفظ بالمجلدات وبملفات الإعداد المخفية، ومنها .openai.
4. الأسهل لنقل جميع الملفات هو Git أو GitHub Desktop.

```sh
git init
git add .
git commit -m "Import Ghazwan Reference Calibration"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/ghazwan-reference-calibration.git
git push -u origin main
```

## Included / محتويات النسخة
- All tracked application source, server API routes, UI, styles, build scripts and dependency lockfile.
- data/points.json: certificate source records; calculation filtering is applied by the application.
- Original certificate PDFs in public/, plus local PDF/OCR assets.
- Database schema and SQL migration in drizzle/.
- Hosting configuration for the existing Sites project, and blank environment examples.
- Latest interpolation logic: exact points first; otherwise nearest lower and upper amplitudes across ranges, keeping model, era, function, frequency and connection consistent.
- 5522A error = Reference Value minus Measurement Result.
- 8508A error = Measurement Result minus Reference Value.
- At 400 µA DC current, both certificate eras use 329 µA and 1.9 mA.

## What is separate from source
This is a source export, not a live database or cloud-storage backup. Workspace changes saved online and PDFs uploaded later are held in the existing D1 database / R2 bucket and are not copied by Git. Use the site's signed-in JSON backup export for workspace data and retain uploaded PDFs separately before moving hosting. The four original certificate PDFs are included here.

Passwords, access tokens, node_modules, generated build output and Git history are not included. Dependencies are reproducible from pnpm-lock.yaml. Configure RECORD_USERNAME and RECORD_PASSWORD privately on the destination server; never commit your real password. .dev.vars.example is a blank local-development template.

## Local setup
Requires Node.js >=22.13.0 and pnpm 11.25.0, as pinned in package.json.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm exec wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_magical_killraven.sql
pnpm start
```

Set local Worker secrets using Wrangler's ignored .dev.vars file for the selected configuration. With the generated configuration above, place it beside dist/server/wrangler.json after building. The production server requires DB (D1) and BUCKET (R2) bindings and the two credential variables. A fresh local database starts with the bundled certificate data and no saved workspace rows.

## Hosting / الاستضافة
رفع الكود إلى GitHub يحفظ ملفات المشروع، لكنه لا ينقل الموقع أو قاعدة البيانات تلقائياً. الموقع يحتوي تسجيل دخول ورفع شهادات وواجهات API، لذلك GitHub Pages وحده لا يشغل النسخة الكاملة.

The existing project uses vinext/Vite and a Cloudflare Worker runtime with D1 and R2. Moving it to another host requires configuring those services, applying the SQL migration, setting the secrets and transferring saved data. The placeholder database ID in vite.config.ts must be replaced/configured for an independent deployment. The existing Sites project ID identifies the current hosted project, not a newly provisioned external deployment.

README.md and tests/calibration.mjs are preserved from the repository; some older descriptions/assertions predate later requirements. This export guide describes the latest calculation behavior. No independent external-host deployment has been performed by exporting these files.
