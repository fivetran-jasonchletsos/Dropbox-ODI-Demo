# Snowflake infra

Run `snowflake_setup.sql` once, as `ACCOUNTADMIN`.

It creates:

| Object | Purpose |
|---|---|
| Warehouse `ODI_WH` | XS, auto-suspend 60s — shared by Fivetran loads and dbt builds |
| Database `ODI_DROPBOX` | Medallion lake root |
| Schema `BRONZE` | Fivetran landing — one table per Dropbox file + `_FILES` |
| Schema `SILVER` | dbt labs (bronze→silver): conformed staging |
| Schema `GOLD` | dbt labs (silver→gold): marts + semantic layer |
| Role `FIVETRAN_LOADER` | Connector write access to BRONZE only |
| Role `DBT_BUILDER` | Read BRONZE, write SILVER + GOLD |
| User `FIVETRAN_USER` | Service account for the connector |

**Before first run:**

```sql
ALTER USER FIVETRAN_USER SET PASSWORD = '<strong-password>';
```

Then in the Fivetran destination config use:
- Host: `<account>.snowflakecomputing.com`
- User: `FIVETRAN_USER`
- Role: `FIVETRAN_LOADER`
- Warehouse: `ODI_WH`
- Database: `ODI_DROPBOX`
- Schema: `BRONZE` (Fivetran will create tables here)

---

## Reading MDLS Iceberg from Snowflake (recommended for ODI)

This is the ODI path: Fivetran Managed Data Lake Service (MDLS) lands the
synced Dropbox data as Apache Iceberg tables in **your** S3 bucket with
metadata registered in **your** AWS Glue Data Catalog. Snowflake reads
those tables in place via an external volume + Glue catalog integration —
no copy, no Snowflake ingest. The dbt `transform/` project then builds
silver and gold against the same Iceberg-backed bronze.

### 1. Why

- **Open storage** — Iceberg tables in S3 are owned by the customer, not by Snowflake.
- **Open catalog** — Glue (or any Iceberg REST catalog) holds the metadata.
- **Compute is a choice** — Snowflake, Athena, EMR, Databricks all read the same tables.

### 2. Prereqs

- MDLS destination provisioned in Fivetran (S3 bucket + Glue DB selected).
- `fdic_files` connector deployed against that MDLS destination, with at least one successful sync.
- AWS account ID where the bucket and Glue DB live.
- The S3 bucket name + prefix Fivetran MDLS lands into.
- The Glue database name Fivetran MDLS publishes to (typically `<connector_id>` lowercased, e.g. `jason_chletsos_sentinel_fdic_files`).
- `snowflake_setup.sql` already run (provides `ODI_DROPBOX`, `BRONZE`, `DBT_BUILDER`).

### 3. Step 1 — IAM role `snowflake-mdls-reader`

Create a single IAM role Snowflake will assume for both S3 and Glue reads.

**Trust policy** (paste the placeholders first, fill `<EXTERNAL_ID>` after Step 3):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::<SNOWFLAKE_AWS_ACCOUNT_ID>:user/<SNOWFLAKE_IAM_USER>" },
      "Action": "sts:AssumeRole",
      "Condition": { "StringEquals": { "sts:ExternalId": "<EXTERNAL_ID>" } }
    }
  ]
}
```

Both `<SNOWFLAKE_AWS_ACCOUNT_ID>` and `<SNOWFLAKE_IAM_USER>` come out of
`DESCRIBE EXTERNAL VOLUME` (Step 3) — the `STORAGE_AWS_IAM_USER_ARN`
field encodes both.

**Read-only permissions policy:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:GetObjectVersion"],
      "Resource": "arn:aws:s3:::<MDLS_BUCKET>/<MDLS_PREFIX>*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::<MDLS_BUCKET>",
      "Condition": { "StringLike": { "s3:prefix": ["<MDLS_PREFIX>*"] } }
    },
    {
      "Effect": "Allow",
      "Action": [
        "glue:GetDatabase",
        "glue:GetDatabases",
        "glue:GetTable",
        "glue:GetTables",
        "glue:GetPartition",
        "glue:GetPartitions"
      ],
      "Resource": [
        "arn:aws:glue:<AWS_REGION>:<AWS_ACCOUNT_ID>:catalog",
        "arn:aws:glue:<AWS_REGION>:<AWS_ACCOUNT_ID>:database/<MDLS_GLUE_DATABASE>",
        "arn:aws:glue:<AWS_REGION>:<AWS_ACCOUNT_ID>:table/<MDLS_GLUE_DATABASE>/*"
      ]
    }
  ]
}
```

### 4. Step 2 — Run `snowflake_iceberg_setup.sql`

Open the file, fill the placeholders in the `FILL IN` block at the top,
and run as `ACCOUNTADMIN`. The first run will fail at the `ALTER ICEBERG
TABLE ... REFRESH` step until Step 3 is complete — that's expected.

### 5. Step 3 — Capture the STS external ID

After the `CREATE EXTERNAL VOLUME` succeeds, Snowflake will have minted a
new external ID. Read it with:

```sql
DESCRIBE EXTERNAL VOLUME ODI_DROPBOX_EXTVOL;
```

Look for `STORAGE_AWS_EXTERNAL_ID` and `STORAGE_AWS_IAM_USER_ARN` in the
properties JSON. Paste both back into the IAM trust policy (Step 1) on
`snowflake-mdls-reader`, then paste the external ID into the
`STORAGE_AWS_EXTERNAL_ID = '<EXTERNAL_ID>'` line of the SQL file and
re-run. Re-run the `ALTER ICEBERG TABLE ... REFRESH` statements.

### 6. Step 4 — Verify

```sql
SELECT COUNT(*) FROM ODI_DROPBOX.BRONZE.FDIC_INSTITUTIONS;
```

Non-zero row count means S3, Glue, IAM, and the catalog integration are
all wired correctly.

### 7. Refresh cadence

Snowflake polls the Glue catalog for new snapshots on a short interval
(the default is on the order of ~30 seconds for `AUTO_REFRESH = TRUE`;
confirm the exact cadence against your Snowflake account's docs — it has
changed across releases). To force a pull immediately after a Fivetran
sync:

```sql
ALTER ICEBERG TABLE ODI_DROPBOX.BRONZE.FDIC_INSTITUTIONS REFRESH;
```

### 8. Troubleshooting

| Symptom | One-line fix |
|---|---|
| `Catalog table 'x.y' not found` | Glue DB or table name mismatch — verify in the AWS Glue console and update `CATALOG_TABLE_NAME`. |
| `Access Denied` on `s3:GetObject` | IAM trust policy is missing the new external ID — re-paste from `DESCRIBE EXTERNAL VOLUME`. |
| Row counts stale after a Fivetran sync | Auto-refresh hasn't ticked yet — run `ALTER ICEBERG TABLE ... REFRESH;`. |
