# Test credentials

Super Admin: `admin@jollys.com` / `Admin123!` (also has access to all admin + super admin features)

## Notes for testers
- Default JKHive `admin_location_id` for testing: `howe-bridge-atherton`.
- AI features (BI insights at `/admin/bi` and `/jkhive/bi`) require an AI key. Universal Emergent key is pre-loaded in dev env via `/app/backend/.env` `EMERGENT_LLM_KEY`. On production, a super admin can paste a key via the "Add key" affordance on the AI Insights panel.
