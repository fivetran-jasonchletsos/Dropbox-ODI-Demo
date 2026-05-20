-- Dropbox-ODI-Demo · Snowflake → Fivetran MDLS (Iceberg on S3 + Glue)
-- ----------------------------------------------------------------------
-- Provisions the Snowflake-side objects that let DBT_BUILDER read the
-- Fivetran MDLS Iceberg tables in place:
--   1) EXTERNAL VOLUME      — Snowflake's handle on the MDLS S3 bucket
--   2) CATALOG INTEGRATION  — points at the AWS Glue Data Catalog
--   3) ICEBERG TABLES       — one Snowflake object per MDLS-landed table
--   4) GRANTS               — DBT_BUILDER SELECT on the new objects
--   5) Manual REFRESH       — force first metadata pull from Glue
--
-- Snowflake reads the Parquet data files directly from S3; nothing is
-- copied into Snowflake. Auto-refresh polls Glue (default ~30s) to pick
-- up new snapshots Fivetran commits.
--
-- Run as ACCOUNTADMIN. Idempotent.
-- ----------------------------------------------------------------------

-- ====== FILL IN ========================================================
-- Replace these placeholders before running. They are intentionally
-- searchable strings — grep for `<` to confirm none remain.
--
--   <MDLS_BUCKET>          e.g.  fivetran-mdls-jason-chletsos
--   <MDLS_PREFIX>          e.g.  sentinel/                 (trailing /)
--   <AWS_ACCOUNT_ID>       12-digit AWS account hosting the MDLS bucket
--   <AWS_REGION>           e.g.  us-east-1
--   <MDLS_GLUE_DATABASE>   Glue DB Fivetran writes to,
--                            e.g.  jason_chletsos_sentinel_fdic_files
--   <EXTERNAL_ID>          Filled in AFTER first run — see Step "Capture
--                            external ID" below.
-- ======================================================================

USE ROLE ACCOUNTADMIN;

-- 1) External volume — Snowflake's read handle on the MDLS S3 location.
--    Snowflake will assume `snowflake-mdls-reader` via STS with the
--    external ID it generates on create; capture it via DESCRIBE below
--    and paste back into the IAM trust policy.
CREATE OR REPLACE EXTERNAL VOLUME ODI_DROPBOX_EXTVOL
  STORAGE_LOCATIONS = ((
    NAME = 'mdls-iceberg-s3'
    STORAGE_PROVIDER = 'S3'
    STORAGE_BASE_URL = 's3://<MDLS_BUCKET>/<MDLS_PREFIX>'
    STORAGE_AWS_ROLE_ARN = 'arn:aws:iam::<AWS_ACCOUNT_ID>:role/snowflake-mdls-reader'
    STORAGE_AWS_EXTERNAL_ID = '<EXTERNAL_ID>'
  ))
  ALLOW_WRITES = FALSE
  COMMENT = 'Fivetran MDLS Iceberg bucket — read-only for ODI demo';

-- Surfaces the STS external ID Snowflake just minted. Copy the value
-- under `STORAGE_AWS_EXTERNAL_ID` and paste it into the IAM trust policy
-- on snowflake-mdls-reader before any table read will succeed.
DESCRIBE EXTERNAL VOLUME ODI_DROPBOX_EXTVOL;

-- 2) Catalog integration — Snowflake reads Iceberg metadata from Glue
--    (not from S3-side metadata.json files). Fivetran MDLS commits each
--    new snapshot into Glue, which is what triggers auto-refresh.
CREATE OR REPLACE CATALOG INTEGRATION ODI_DROPBOX_GLUE
  CATALOG_SOURCE = GLUE
  TABLE_FORMAT = ICEBERG
  GLUE_AWS_ROLE_ARN = 'arn:aws:iam::<AWS_ACCOUNT_ID>:role/snowflake-mdls-reader'
  GLUE_CATALOG_ID = '<AWS_ACCOUNT_ID>'
  GLUE_REGION = '<AWS_REGION>'
  ENABLED = TRUE
  COMMENT = 'Glue catalog for Fivetran MDLS Iceberg tables';

-- 3) Register MDLS-landed Iceberg tables as Snowflake objects.
--    CATALOG_TABLE_NAME is the qualified Glue identifier
--    (<glue_db>.<glue_table>) that Fivetran MDLS publishes — typically
--    `<connector_id>.<table_name>` in lowercase.
USE DATABASE ODI_DROPBOX;
USE SCHEMA BRONZE;

CREATE OR REPLACE ICEBERG TABLE FDIC_INSTITUTIONS
  EXTERNAL_VOLUME = 'ODI_DROPBOX_EXTVOL'
  CATALOG = 'ODI_DROPBOX_GLUE'
  CATALOG_TABLE_NAME = '<MDLS_GLUE_DATABASE>.fdic_institutions'
  AUTO_REFRESH = TRUE;

CREATE OR REPLACE ICEBERG TABLE FDIC_FAILED_BANK_LIST
  EXTERNAL_VOLUME = 'ODI_DROPBOX_EXTVOL'
  CATALOG = 'ODI_DROPBOX_GLUE'
  CATALOG_TABLE_NAME = '<MDLS_GLUE_DATABASE>.fdic_failed_bank_list'
  AUTO_REFRESH = TRUE;

CREATE OR REPLACE ICEBERG TABLE FDIC_SUMMARY_OF_DEPOSITS
  EXTERNAL_VOLUME = 'ODI_DROPBOX_EXTVOL'
  CATALOG = 'ODI_DROPBOX_GLUE'
  CATALOG_TABLE_NAME = '<MDLS_GLUE_DATABASE>.fdic_summary_of_deposits'
  AUTO_REFRESH = TRUE;

CREATE OR REPLACE ICEBERG TABLE _FILES
  EXTERNAL_VOLUME = 'ODI_DROPBOX_EXTVOL'
  CATALOG = 'ODI_DROPBOX_GLUE'
  CATALOG_TABLE_NAME = '<MDLS_GLUE_DATABASE>._files'
  AUTO_REFRESH = TRUE;

-- 4) Grants — DBT_BUILDER already has SCHEMA USAGE from snowflake_setup.sql.
--    Iceberg tables require an explicit SELECT grant; FUTURE TABLES covers
--    any tables Fivetran adds to this Glue DB later.
GRANT SELECT ON ALL TABLES IN SCHEMA ODI_DROPBOX.BRONZE TO ROLE DBT_BUILDER;
GRANT SELECT ON FUTURE TABLES IN SCHEMA ODI_DROPBOX.BRONZE TO ROLE DBT_BUILDER;

-- 5) Force a first metadata refresh so the tables are queryable now,
--    rather than waiting for the auto-refresh tick.
ALTER ICEBERG TABLE FDIC_INSTITUTIONS REFRESH;
ALTER ICEBERG TABLE FDIC_FAILED_BANK_LIST REFRESH;
ALTER ICEBERG TABLE FDIC_SUMMARY_OF_DEPOSITS REFRESH;
ALTER ICEBERG TABLE _FILES REFRESH;

-- Smoke check ----------------------------------------------------------
SHOW ICEBERG TABLES IN SCHEMA ODI_DROPBOX.BRONZE;
SELECT COUNT(*) AS institution_rows FROM ODI_DROPBOX.BRONZE.FDIC_INSTITUTIONS;
