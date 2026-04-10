-- Add unique constraint to tokenHash
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_tokenHash_unique" UNIQUE ("tokenHash");
