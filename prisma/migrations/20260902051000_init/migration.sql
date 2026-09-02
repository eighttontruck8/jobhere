-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EnterpriseType" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "PostingSource" AS ENUM ('CRAWLED', 'USER');

-- CreateEnum
CREATE TYPE "CriterionType" AS ENUM ('LANGUAGE', 'KOREAN_HISTORY', 'OTHER_CERT');

-- CreateEnum
CREATE TYPE "RequiredFlag" AS ENUM ('REQUIRED', 'OPTIONAL');

-- CreateTable
CREATE TABLE "JobPosting" (
    "id" TEXT NOT NULL,
    "enterpriseType" "EnterpriseType" NOT NULL,
    "company" TEXT,
    "jobRole" TEXT,
    "title" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "jobCategory" TEXT,
    "source" "PostingSource" NOT NULL DEFAULT 'CRAWLED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationCriterion" (
    "id" TEXT NOT NULL,
    "postingId" TEXT NOT NULL,
    "type" "CriterionType" NOT NULL,
    "requiredFlag" "RequiredFlag" NOT NULL,
    "cutoffScore" INTEGER,
    "acceptableCerts" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "EvaluationCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CredentialProfile" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "languageScore" INTEGER,
    "koreanHistoryGrade" INTEGER,
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CredentialProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobPosting_enterpriseType_createdAt_idx" ON "JobPosting"("enterpriseType", "createdAt");

-- CreateIndex
CREATE INDEX "JobPosting_deadline_idx" ON "JobPosting"("deadline");

-- CreateIndex
CREATE INDEX "JobPosting_jobCategory_idx" ON "JobPosting"("jobCategory");

-- CreateIndex
CREATE INDEX "EvaluationCriterion_postingId_idx" ON "EvaluationCriterion"("postingId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationCriterion_postingId_type_key" ON "EvaluationCriterion"("postingId", "type");

-- AddForeignKey
ALTER TABLE "EvaluationCriterion" ADD CONSTRAINT "EvaluationCriterion_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
