-- AlterTable
ALTER TABLE "users" ADD COLUMN     "aiApiKey" TEXT,
ADD COLUMN     "aiApiUrl" TEXT,
ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "aiProvider" TEXT DEFAULT 'mock';
