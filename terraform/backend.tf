# terraform {
#   backend "s3" {
#     bucket         = "realtime-collab-terraform-state"
#     key            = "environments/default/terraform.tfstate"
#     region         = "us-east-1"
#     encrypt        = true
#     dynamodb_table = "realtime-collab-terraform-locks"
#   }
# }

# NOTE: The S3 bucket and DynamoDB table for remote state must be created
# manually (or via a bootstrap script) before running `terraform init`.
#
# Bootstrap commands:
#   aws s3api create-bucket \
#     --bucket realtime-collab-terraform-state \
#     --region us-east-1
#
#   aws s3api put-bucket-versioning \
#     --bucket realtime-collab-terraform-state \
#     --versioning-configuration Status=Enabled
#
#   aws s3api put-bucket-encryption \
#     --bucket realtime-collab-terraform-state \
#     --server-side-encryption-configuration \
#       '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
#
#   aws dynamodb create-table \
#     --table-name realtime-collab-terraform-locks \
#     --attribute-definitions AttributeName=LockID,AttributeType=S \
#     --key-schema AttributeName=LockID,KeyType=HASH \
#     --billing-mode PAY_PER_REQUEST \
#     --region us-east-1
#
# Per-environment state paths:
#   dev:     environments/dev/terraform.tfstate
#   staging: environments/staging/terraform.tfstate
#   prod:    environments/prod/terraform.tfstate
#
# To initialise for a specific environment, override the key:
#   terraform init -backend-config="key=environments/dev/terraform.tfstate"
