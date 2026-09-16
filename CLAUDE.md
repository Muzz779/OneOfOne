# CLAUDE.md

@AGENTS.md

> **Stack note (added during scaffold):** This project runs **Next.js 16.3.5, React 19.2.8, Tailwind v4** — newer than most training data. Read the bundled docs under `node_modules/next/dist/docs/01-app/` before writing framework-sensitive code (route handlers, server actions, caching, images, metadata). See `AGENTS.md` (imported above).
>
> **Chosen implementation stack (delegated decisions):** Supabase (Postgres + Auth + Storage w/ signed URLs + RLS) for data/storage/auth; Yoco as the target payment provider, built mock-first behind a `PaymentProvider` interface; build order follows §59 — the artwork-pipeline vertical slice first.

## Project Overview

Build a production-ready, mobile-first South African custom print-on-demand apparel platform.

The core customer proposition:

Upload any image. Choose what you want printed on. We make it print-ready.

Customers should be able to:

1. Upload an image/design.
2. Have the system automatically assess whether it is suitable for printing.
3. Automatically enhance low-quality artwork when appropriate.
4. Remove backgrounds when requested.
5. Select an apparel product.
6. Select garment colour and size.
7. Position, resize and rotate the artwork within the actual printable area.
8. See a realistic live mockup.
9. Choose print size/area and optional print sides.
10. See transparent, accurate pricing.
11. Checkout and pay.
12. Select delivery/collection options.
13. Receive order confirmation and tracking information.
14. Have the exact production artwork generated and sent to the production workflow.

This is NOT merely an ecommerce website.

The architecture must treat the system as:

Customer artwork → artwork processing → print preflight → production artwork → order → production → fulfillment

The storefront is only one part of the system.

---

## 1. Core Product Principles

### 1.1 Print quality comes first

Never allow the application to imply that putting a low-resolution image inside a PDF magically makes it high quality.

A PDF containing a low-resolution raster image is still a low-resolution image.

The system must calculate the artwork's effective resolution at the selected physical print dimensions.

Example: 30 × 40 cm at 300 DPI requires approximately 3543 × 4724 pixels.

The exact target DPI MUST be configurable according to the printer's production requirements. Do NOT hard-code 300 DPI as an absolute requirement without confirmation from the production specification.

---

## 2. Printer Specification Contract

Create a central configurable printer specification. Do not scatter printer-specific assumptions throughout the codebase.

The printer configuration must be able to define:
- Printing technology: DTF / DTG / Sublimation / Other
- Required file format: PNG / PDF / SVG / TIFF / Other
- Required DPI/PPI
- Maximum printable width
- Maximum printable height
- Print bleed requirements
- Colour mode: RGB / CMYK / Other
- Colour profile where applicable
- Transparency requirements
- Whether front/back artwork is separate
- Maximum file size
- Minimum effective resolution
- Accepted vector formats
- Naming convention
- Production notes

The printer configuration should be stored centrally and be easy to change. The rest of the application should consume this configuration rather than duplicating values.

---

## 3. Artwork Pipeline

UPLOAD → VALIDATE → ANALYZE → QUALITY CHECK → OPTIONAL AI ENHANCEMENT → OPTIONAL BACKGROUND REMOVAL → EDITOR → PRINT-SIZE CALCULATION → PRE-FLIGHT → PRODUCTION ARTWORK → MOCKUP → ORDER

---

## 4. Original vs Production Artwork

NEVER overwrite the customer's original upload. Maintain separate assets:

- **Original Artwork** — the exact file uploaded by the customer.
- **Working Artwork** — the editable/processed artwork used by the editor.
- **Production Artwork** — the final immutable file generated specifically for printing.
- **Mockup Artwork** — the artwork used to generate the customer-facing product preview.

Where possible, the mockup must derive from the same production artwork. The customer should never see a beautiful mockup generated from one asset while the printer receives a different asset.

---

## 5. Artwork Quality Analysis

When an image is uploaded, calculate: original pixel dimensions, file type, file size, aspect ratio, transparency, effective DPI at selected print dimensions, whether the image is raster or vector, whether it appears suitable for printing, and whether enhancement is recommended or required.

Quality states should be understandable to customers, not technical jargon:
- **Excellent** — "Your image is high enough quality for this print size."
- **Good** — "Your image should print well at this size."
- **Needs Enhancement** — "Your image is a little small for this print size. We recommend enhancing it."
- **Too Low Quality** — "This image is too small to reliably print at this size."

---

## 6. AI Image Enhancement

Implement AI upscaling/enhancement as an optional processing stage.

AI enhancement cannot recover information that genuinely does not exist. It may improve perceived detail, but it can also invent details. Therefore:
- Never claim enhancement guarantees perfect quality.
- Show the user that enhancement was applied.
- Allow comparison of original vs enhanced where practical.
- Preserve the original; store the enhanced asset separately.
- Run another quality/preflight check after enhancement.

Do not upscale every image automatically — only when the artwork requires it. The AI enhancement provider must be abstracted behind a service interface so the provider can be changed later (see Section 34C for a candidate provider).

---

## 7. Vector Artwork

Treat vector artwork differently from raster artwork. Supported vector artwork should not unnecessarily be converted to a low-resolution raster. For logos, typography, line art, illustrations, SVG/PDF artwork — preserve vector information where the printer workflow supports it.

If vectorization is offered for raster artwork, clearly distinguish "Enhance image" from "Convert to vector" — these are different operations.

---

## 8. Background Removal

Support optional background removal. The customer should be able to choose: keep background / remove background / automatically remove background.

Transparency must be preserved in the production artwork where required. Never flatten transparent artwork onto a white background accidentally.

---

## 9. Print Area System

Every product must have a configurable printable area (e.g. T-shirt: front/back printable width & height, position offsets; Hoodie: front/back width & height, sleeve area if supported). Do NOT assume every garment has the same print area. The editor must constrain artwork inside the actual printable region.

---

## 10. Physical Print Dimensions

Internally maintain width/height in mm/cm, pixel dimensions required for production, and effective DPI. Do not simply scale a preview image and assume it is production-ready — calculate required production resolution from the configured printer DPI.

---

## 11. Design Editor

Mobile-first. Customers should be able to: upload, drag, resize, rotate, center, reset, zoom, position, remove background, enhance image, change print side, change print size.

The editor must visually communicate the printable area using a garment mockup with a clear but subtle print boundary. Do not make the customer guess where their artwork can be printed.

---

## 12. Design Autosave

Design work must not disappear on refresh, accidental tab close, product change, checkout navigation, or temporary connection loss. Designs should have unique IDs; customers should be able to resume an unfinished design.

---

## 13. Mockups

Mockups must show correct garment, colour, artwork, positioning, and approximate print scale. The mockup is a preview, not a guarantee of exact physical colour/appearance — include wording such as: "Preview shown for illustration. Actual print colour and garment appearance may vary slightly." Avoid making the mockup unnecessarily fake-looking.

---

## 14. Products

Products should be data-driven: name, category, base price, available sizes/colours, inventory, printable sides, printable areas, maximum print dimensions, print pricing rules, mockup assets, product images, description, active/inactive status. Do not hard-code product information into UI components.

---

## 15. Inventory

Track by PRODUCT + COLOUR + SIZE. Prevent purchase of unavailable combinations. Update inventory safely after successful payment/order confirmation — do not rely exclusively on frontend inventory checks.

---

## 16. Pricing Engine

Pricing must be calculated server-side. Components: garment cost, print cost, print size, number of printed sides, additional print areas, packaging, payment processing fees, delivery, optional extras, discounts/promotions.

Current indicative internal supply costs (NOT hard-coded — configurable): T-shirt ≈ R60, Hoodie ≈ R300, Printing ≈ up to R100 depending on print size. PUDO is the intended delivery method.

Create configurable pricing rules so actual supplier/printer costs can change without rewriting the application.

---

## 17. Margin Protection

Admin must see: customer price, garment cost, printing cost, packaging cost, delivery cost, payment fee, estimated gross profit, gross margin. Never expose internal cost/margin information to customers.

---

## 18. Checkout

Simple, mobile-first. Collect only information required to fulfill the order. Flow: Cart → Customer details → Delivery/collection → Payment → Confirmation. Never make checkout unnecessarily long.

---

## 19. Payments

Payment confirmation MUST happen server-side. Never trust frontend payment success screens, client-side price calculations, or client-side order status. Use payment-provider webhooks with signature verification, idempotency, duplicate webhook protection, and payment status reconciliation. Order transitions to paid only after verified payment confirmation.

---

## 20. Order State Machine

States: DRAFT, PENDING_PAYMENT, PAID, ARTWORK_PROCESSING, ARTWORK_REVIEW, PRINT_READY, IN_PRODUCTION, PACKED, READY_FOR_COLLECTION, SHIPPED, DELIVERED, CANCELLED, REFUND_PENDING, REFUNDED, FAILED. Use a controlled state machine, not arbitrary strings scattered through the app.

---

## 21. Production Workflow

Once payment is confirmed: freeze the order → freeze production artwork → generate production files → run final preflight → generate production metadata → add to production queue → printer/admin downloads production files → order moves into production → packed → delivery arranged → tracking recorded → customer updated.

A production file must never silently change after the order enters production.

---

## 22. Production File Versioning

Every production artwork must record: Order ID, Design ID, Artwork version, Product, Garment colour, Garment size, Print side, Physical dimensions, DPI, File format, Creation timestamp, Preflight result. Example: `ORDER-1042 / DESIGN-883 / VERSION-2 / FRONT / 300×400mm / PNG / 300DPI`. This prevents printing the wrong file.

---

## 23. Preflight System

Before an order enters production, check: correct physical/pixel dimensions, effective DPI, supported file format, correct colour mode, transparency requirements, bleed, artwork inside printable area, no accidental clipping, no missing artwork, file opens correctly, file size within limits, product/garment matches order, print side matches order. Return PASS or FAIL + exact reason. An admin should never have to guess whether a production file is safe to print.

---

## 24. Printer Output

Production output must follow the printer's exact specification — do not assume "PDF = professional" or "300 DPI = always correct." The printer specification (Section 2) is the source of truth. The output generator must support PNG, PDF, SVG, TIFF, or another required format.

---

## 25. Admin Dashboard

Owner must be able to: view/search/filter orders, view customer details, view artwork and production artwork, download production files, view preflight status, approve/reject artwork, change order status, manage products/inventory/pricing, view production queue, record tracking numbers, handle refunds, view sales/profit/basic analytics. Not optional.

---

## 26. Production Queue

Dedicated queue showing e.g. "PRINT TODAY — ORDER-1042, Black L T-shirt, Front, 300×400mm, PRINT READY" with [Download Production File] and [Mark In Production] actions. Should make fulfillment extremely simple.

---

## 27. Customer Artwork Privacy

Secure storage, access control, signed/private URLs where appropriate, server-side authorization, file type validation, file size limits, safe file processing, automatic cleanup of abandoned uploads. Do not expose arbitrary storage buckets publicly.

---

## 28. File Security

Never trust uploaded filenames or MIME types. Validate extension, MIME type, actual file structure where practical, maximum file size, image dimensions. Sanitize filenames; generate internal UUIDs rather than using customer filenames as storage keys.

---

## 29. Copyright / User-Uploaded Content

Customers can upload copyrighted or inappropriate material. Implement appropriate terms of service, user responsibility language, prohibited-content policy, reporting mechanism, takedown/contact mechanism. Do not automatically assume the platform has rights to reproduce uploaded content. Do not attempt to make legal determinations automatically.

---

## 30. Refunds / Reprints

Define policies for: wrong size selected, customer supplied incorrect artwork, printer defect, damaged garment, wrong garment/print, lost shipment, customer cancellation. Record the reason for every refund/reprint.

---

## 31. Delivery

PUDO is the initial intended delivery provider, but delivery must be abstracted behind a delivery service supporting: delivery quote, delivery option, collection where applicable, tracking number, tracking URL, delivery status. Do not tightly couple the order system to one delivery provider.

---

## 32. Notifications

Order received, payment confirmed, artwork processing, artwork issue, order in production, packed, shipped, delivered, refund processed. Do not spam customers.

---

## 33. Mobile-First UX

Large touch targets, simple controls, minimal typing, fast image upload (camera/photo-library), sticky checkout CTA, easy product/colour/size selection, responsive mockups, fast loading. Do not build desktop-first and "make it responsive" afterward.

---

## 34. Visual Design System (RESOLVED — single identity, not a per-component menu)

### 34A. Core Visual Philosophy

NO "AI Slop" Aesthetics. Strictly avoid: generic white-card-on-gray-background grids, default system sans-serif fonts, uniform 8px border-radius everywhere, cliché purple/blue gradient buttons, giant centered text with random gradient blobs, excessive glassmorphism without purpose, generic SaaS landing-page templates, decorative elements with no function.

Every layout must have intentional whitespace, strong hierarchy, and high contrast.

### 34B. Chosen Identity: Neo-Brutalist / Modern Raw

**Decision rule: this is the ONE identity for the entire product — storefront, editor, checkout, admin. Do not let different screens adopt different moods; that reads as inconsistent, not distinctive.** If you want to change the brand direction, change it here once, not per-component.

- **Typography:** Bold display font for headers (e.g. Space Grotesk), monospaced accents for technical/production-facing UI (order IDs, DPI/dimension labels), clean sans for body copy.
- **Palette:** High-contrast primary colours drawn from actual garment/product photography, solid black borders (`2px border-black`), hard box-shadows (`shadow-[4px_4px_0px_#000]`) on interactive elements.
- **Layout:** Sharp edges (`rounded-none` as the default, not `rounded-2xl`), distinct component blocks, playful badge elements for status (quality check results, order states), asymmetric layouts over repetitive identical-card grids.
- **Why this fits the brand specifically:** the product differentiator is "anyone can upload anything and get a print-ready result" — a confident, raw, slightly irreverent visual identity matches a streetwear/custom-apparel audience better than a polished enterprise-SaaS look, and it photographs well against real garment mockups rather than competing with them.
- **Admin dashboard exception:** the admin/production-queue views (Sections 25–26) may relax the bold styling toward higher information density — the owner needs to scan orders fast, not be visually impressed. Keep the same typography and palette, but reduce decorative shadow/border weight there.

### 34C. Front-End Tech Stack & Components

- **UI primitives:** `shadcn/ui` + `Radix Primitives` for functional components instead of raw unstyled elements.
- **Animation:** `Framer Motion` for micro-interactions, page transitions, staggered mounting (`initial={{ opacity: 0, y: 10 }}`). Respect `prefers-reduced-motion`.
- **Complex hero/interactive elements:** component libraries such as `Magic UI` or `Aceternity UI` for hero sections and interactive cards — use sparingly, and only where it reinforces the Neo-Brutalist identity (sharp, high-contrast), not glassmorphism-heavy defaults from those libraries.
- **Layout rule:** avoid repetitive grids of identical cards. Use asymmetric layouts, floating elements, overlapping panels, sticky sidebars where appropriate — especially in the design editor (Section 11) and product catalogue.
- **Custom imagery/mockup generation:** use the Higgsfield MCP server (`https://mcp.higgsfield.ai/mcp` — connect this in your local Claude Code MCP config, see Section 60) and/or `github.com/Anil-matcha/Open-Higgsfield-AI` for any generated hero/marketing imagery, so visuals aren't generic stock-AI output. Do not use this for actual customer garment mockups (Section 13) — those must be derived from real production artwork, not AI-generated approximations, per the "do not fake functionality" rule in Section 53.

---

## 35. Animation

Good uses: artwork upload transition, image enhancement progress, product switching, mockup transitions, cart updates, checkout confirmation, success states. Avoid animation that slows the editor or makes it harder to use. Respect reduced-motion preferences.

---

## 36. Performance

Do not perform heavy image processing unnecessarily in the browser. Separate CLIENT-SIDE INTERACTION from SERVER-SIDE PRODUCTION PROCESSING. Use optimized preview assets for the UI while maintaining original/production assets separately. Do not load production-resolution files into every browser view.

---

## 37. Storage Architecture

Separate logically: `/originals`, `/working`, `/production`, `/mockups`, `/exports`. Immutable production files after order confirmation. Lifecycle/cleanup policies for temporary files.

---

## 38. Database Design

At minimum model: users, products, product_variants, inventory, designs, design_assets, print_areas, pricing_rules, carts, cart_items, orders, order_items, payments, shipments, production_jobs, production_assets, preflight_results, refunds, notifications, admin_users. Do not put all application state into one massive orders table.

---

## 39. IDs

Stable unique IDs for users, designs, assets, orders, payments, production jobs. Human-readable order numbers can exist alongside internal IDs (internal: UUID; customer-facing: #1042).

---

## 40. API / Backend Security

All important business logic server-side. Never trust the client for price, inventory, payment status, user permissions, production status, order ownership, discount validity. Validate authorization on every protected server operation.

---

## 41. Rate Limiting

Protect expensive endpoints: image enhancement, background removal, vectorization, checkout, login, upload, webhooks. AI processing can become an expensive attack vector — add appropriate rate limits and usage controls.

---

## 42. AI Cost Control

Do not automatically run AI processing every time the customer moves an image. Use debouncing, caching, asset hashes, processing-status tracking, and reuse of identical processed assets where appropriate. Do not pay for the same enhancement repeatedly.

---

## 43. Design Hashing

Generate hashes for uploaded/processed assets where practical, to identify duplicate files and prevent unnecessary processing.

---

## 44. Analytics

Track the funnel: Landing → Upload → Quality analysis → Enhancement → Product selected → Design completed → Add to cart → Checkout started → Payment successful → Order completed. Metrics: upload conversion, design completion rate, checkout conversion, purchase conversion, average order value, popular garments/sizes/colours/print sizes, enhancement usage, failed preflight rate, refund rate, repeat purchase rate. Do not collect unnecessary personal information.

---

## 45. Error Handling

Errors must be understandable. Bad: "Error 500." Better: "We couldn't process that image. Try uploading a JPG, PNG or SVG under 20MB." Show useful information to admins while avoiding sensitive internal details for customers.

---

## 46. Accessibility

Keyboard navigation, screen readers where practical, proper labels, sufficient contrast, visible focus states, reduced motion, accessible form errors. Do not sacrifice accessibility for visual effects — this applies to the Neo-Brutalist identity too: hard shadows and bold borders must not compromise contrast ratios or focus visibility.

---

## 47. SEO

Storefront should be indexable: custom T-shirts, custom hoodies, custom apparel, product categories, individual products. Real product content, not keyword stuffing. The design editor itself does not need to be indexed.

---

## 48. Social Sharing

Design created → generate shareable preview → customer can share. Do not expose private customer artwork publicly by default — sharing must be opt-in.

---

## 49. Testing

Before declaring the application complete, test:

**Upload:** JPG, PNG, SVG, large file, tiny image, transparent image, invalid file.
**Quality:** high-res, low-res, very low-res, portrait, landscape, square.
**Editor:** resize, rotate, move, crop, product switching, colour switching, front/back.
**Checkout:** successful payment, failed payment, duplicate webhook, refresh during payment, out-of-stock item.
**Production:** correct file, dimensions, DPI, product, colour, size, print side.
**Security:** unauthorized order access, unauthorized production-file access, malicious upload, invalid API requests.
**Visual design:** screenshot key screens (landing, editor, checkout, admin) via Playwright and verify against Section 34 — no drift toward generic defaults (see Section 60).

---

## 50. Development Approach

Build in vertical slices, not one giant implementation.

**Phase 1 — Foundation:** project setup, database, authentication, product model, product catalogue, basic storefront, admin authentication.
**Phase 2 — Design Studio:** upload, image analysis, product selection, print-area editor, mockup, autosave.
**Phase 3 — Print Intelligence:** DPI calculation, quality analysis, AI enhancement, background removal, preflight, production asset generation.
**Phase 4 — Commerce:** cart, pricing engine, checkout, payment, order creation, inventory.
**Phase 5 — Fulfillment:** production queue, production downloads, order statuses, delivery, tracking, notifications.
**Phase 6 — Polish:** mobile UX, animation, SEO, analytics, accessibility, performance, error handling, security hardening, design-system verification (Section 60).

---

## 51. Important Architecture Rule

Do not create unnecessary complexity before the core workflow works. The MVP must support:

UPLOAD → QUALITY CHECK → ENHANCE IF NEEDED → SELECT GARMENT → POSITION ARTWORK → MOCKUP → PRICE → PAY → GENERATE PRINT-READY FILE → ADMIN DOWNLOADS FILE → FULFILL ORDER

Everything else is secondary.

---

## 52. Source of Truth

- Technical production requirements → Printer specification (Section 2)
- Prices → Admin pricing configuration
- Inventory → Database
- Payment → Verified payment provider webhook
- Production → Immutable production artwork
- Customer preview → Production artwork-derived mockup

---

## 53. Do Not Fake Functionality

Never create UI that pretends something works when it doesn't: no fake "AI Enhanced" badge without real enhancement, no fake payment success, no fake tracking, no fake "print-ready" status without running preflight, no fake inventory numbers, no fake printer integrations. If an integration is not implemented, isolate it behind an interface with a clearly-marked development/mock implementation.

---

## 54. Product Philosophy

The differentiator is not "custom T-shirts" — that market already exists. It's the experience: upload anything → make it print-ready → see exactly what you're ordering → buy easily → receive locally. The customer should not need Photoshop, Illustrator, DPI knowledge, background-removal tools, or print-production knowledge. The platform handles that complexity.

---

## 55. Critical Business Assumptions

Planning-only figures, NOT hard-coded: T-shirt garment cost ≈ R60, Hoodie garment cost ≈ R300, Printing ≈ up to R100 depending on print size, Delivery via PUDO. All costs must be configurable from the admin side. Retail pricing should be derived from actual total landed cost and desired margin, not a flat markup on garment cost alone.

---

## 56. Final Quality Standard

Before considering the project finished, verify:
- **Customer:** can someone with zero design/printing knowledge order a good-quality printed garment from a random phone photo?
- **Production:** can the printer immediately understand what to print, on what garment, what size/colour/side/dimensions, from what file?
- **Owner:** can they manage products, inventory, prices, orders, artwork, production, delivery, refunds without touching code?
- **Engineering:** does the app survive bad uploads, failed payments, duplicate webhooks, out-of-stock products, low/high-res images, abandoned designs, unauthorized requests without corrupting orders or production files?

If yes to all four, the system is ready to move beyond a prototype.

---

## 57. Claude Code Behaviour

1. Inspect the existing codebase before making architectural decisions.
2. Do not unnecessarily rewrite working code.
3. Reuse existing components and utilities when appropriate.
4. Keep business logic out of presentation components.
5. Keep printer/payment/delivery/AI integrations behind service abstractions.
6. Validate important operations server-side.
7. Use strong TypeScript types.
8. Avoid duplicated constants and magic numbers.
9. Keep production artwork immutable after order confirmation.
10. Write tests for critical business logic.
11. Do not claim functionality is complete unless it is actually implemented.
12. If a requirement is ambiguous, inspect the existing architecture and configuration first.
13. Prefer simple maintainable solutions over unnecessary infrastructure.
14. Do not sacrifice production reliability for visual effects.
15. Prioritize mobile UX.
16. Keep the UI visually distinctive per Section 34 — one identity, applied consistently, not generic SaaS.
17. Before adding a dependency, determine whether the project already has a suitable solution.
18. Do not expose secrets in client-side code.
19. Never hard-code credentials, API keys, payment secrets, or production configuration.

---

## 58. Before Production Launch

Verify with the actual printer: printing method, maximum print dimensions, required DPI, required file format, colour mode, colour profile, transparency requirements, bleed requirements, whether vector files are accepted, whether front/back files are separate, naming requirements, file delivery method, whether artwork requires manual approval, maximum file size, garment-specific limitations. These specifications then become the application's printer configuration (Section 2). Do not finalize the production-export pipeline until these are known.

---

## 59. First Priority

Do not start by building a huge ecommerce website. First prove the hardest, most valuable workflow:

Phone image upload → quality analysis → AI enhancement if required → print-area editor → production-resolution calculation → preflight → print-ready output → accurate mockup

Once this works reliably, build the commerce and fulfillment layer around it.

---

## 60. Design Tooling, Plugins & MCP Servers (manual setup — run once, before starting Claude Code)

This document has no execution capability — it is read by Claude Code, not run by it. A `setup.sh` is included alongside this file bundling the three registration commands below into one. Run it in your plain terminal, in this project's root directory, **before** starting (or after restarting) your Claude Code session — not from inside an active session, since Anthropic's own installation docs are inconsistent about whether these commands work reliably when invoked from within Claude Code itself:

```
bash setup.sh
```

Equivalent to running individually:

```
claude plugin add frontend-design
claude mcp add playwright
claude mcp add --transport http higgsfield https://mcp.higgsfield.ai/mcp
```

Verify afterward with `claude mcp list`.

- **`frontend-design` plugin** — reinforces Section 34's anti-generic-AI design rules during generation.
- **`playwright` MCP** — use to screenshot key screens (landing, editor, checkout, admin) and verify against Section 34 before considering any UI work complete. This is how you catch drift back to generic defaults instead of trusting the prompt alone.
- **Higgsfield MCP** (`https://mcp.higgsfield.ai/mcp`) — add this to your local Claude Code MCP config for generating custom hero/marketing imagery (Section 34C). Do not use it for customer-facing garment mockups (Section 13) — those must derive from real production artwork.
- **`security-guidance` plugin** (recommended addition, not in original stack) — this platform handles customer-uploaded files, payment webhooks, and production file access (Sections 19, 27, 28, 40) — enable this plugin given that exposure surface.
- **`Anil-matcha/Open-Higgsfield-AI`** (github.com/Anil-matcha/Open-Higgsfield-AI) — alternative/reference implementation for the same multi-model image/video generation approach if the hosted Higgsfield MCP doesn't cover a needed case.
- **`mksglu/context-mode`** (github.com/mksglu/context-mode) — apply if the artwork-analysis or preflight pipeline's tool output starts consuming excessive context during long Claude Code sessions on this codebase.
