# Security Specification: Email Backup Vault (`backups` & `chunks`)

## 1. Data Invariants
1. A backup header `/backups/{userId}` can ONLY be read, written, or deleted by the authenticated owner whose `request.auth.uid == userId` and whose `ownerUid` equals `request.auth.uid`.
2. All writes require a verified email token (`request.auth.token.email_verified == true`), blocking unverified/spoofed email writes.
3. Backup chunks `/backups/{userId}/chunks/{chunkId}` enforce the Master Gate by fetching `/backups/{userId}` via `get()` and confirming `ownerUid == request.auth.uid`.
4. All document IDs (`userId`, `chunkId`) must match `^[a-zA-Z0-9_\-]+$` and be `<= 128` characters.
5. `ownerUid`, `createdAt`, chunk `kind`, and `chunkIndex` are immutable after creation; `createdAt` and `updatedAt` must equal `request.time`.
6. Every string has strict `.size()` bounds, nested maps (`profile`, `settings`, `data`) have strict `hasAll`/`hasOnly` key allowlists, and `checksum` must be a valid 64-char SHA-256 hex digest.

## 2. The "Dirty Dozen" Payloads (Expected: `PERMISSION_DENIED`)
1. **Cross-user read**: Authenticated user `userB` reads `/backups/userA`.
2. **Cross-user write**: Authenticated user `userB` writes `/backups/userA` with `ownerUid: "userB"`.
3. **Identity spoofing**: `userA` creates `/backups/userA` with `ownerUid: "userB"`.
4. **Shadow/Ghost field injection**: `userA` adds `isAdmin: true` or `extraField: "hack"` to `/backups/userA`.
5. **Unverified email spoofing**: Authenticated user with `email_verified: false` attempts to write `/backups/userA`.
6. **Blanket list scraping**: `userB` runs `collection('backups')` without matching `ownerUid == request.auth.uid`.
7. **Timestamp forgery**: `userA` creates `/backups/userA` with a past client timestamp instead of `request.time`.
8. **Immutable field tampering**: `userA` modifies `createdAt` or `ownerUid` on update.
9. **ID poisoning**: `userA` attempts a write to `/backups/../../evil` or a 200-char ID.
10. **Resource exhaustion**: `userA` submits a 2MB `profile.avatar` or 500-char `deviceName`.
11. **Orphaned chunk write**: `userA` writes `/backups/userA/chunks/c0` before `/backups/userA` exists.
12. **Chunk type/index mutation**: `userA` updates `kind` from `"conversations"` to `"contacts"` on an existing chunk.
