ALTER TYPE "CriterionType" ADD VALUE 'COMPUTER_SKILL';

ALTER TABLE "EvaluationCriterion"
ADD COLUMN "languageRequirements" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "CredentialProfile"
ADD COLUMN "languageCredentials" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "computerSkillGrade" INTEGER;

UPDATE "CredentialProfile"
SET "languageCredentials" = jsonb_build_array(
  jsonb_build_object(
    'testType', 'TOEIC',
    'score', "languageScore",
    'level', NULL
  )
)
WHERE "languageScore" IS NOT NULL;

ALTER TABLE "CredentialProfile" DROP COLUMN "languageScore";
