/*
  Warnings:

  - You are about to drop the column `user_id` on the `github_connections` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[workspace_id]` on the table `github_connections` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `workspace_id` to the `github_connections` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "github_connections" DROP CONSTRAINT "github_connections_user_id_fkey";

-- DropIndex
DROP INDEX "github_connections_user_id_key";

-- AlterTable
ALTER TABLE "github_connections" DROP COLUMN "user_id",
ADD COLUMN     "workspace_id" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "github_connections_workspace_id_key" ON "github_connections"("workspace_id");

-- AddForeignKey
ALTER TABLE "github_connections" ADD CONSTRAINT "github_connections_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
