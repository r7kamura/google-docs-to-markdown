# google-docs-to-markdown

Custom action to export Google Docs to local file system as Markdown files.

## Usage

This is an example workflow to export docs daily at 00:00 (GMT).

```yaml
# .github/workflows/import.yml
name: import

on:
  schedule:
    - cron: "0 0 * * *"

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: google-github-actions/auth@v0
        with:
          service_account: ${{ secrets.GOOGLE_SERVICE_ACCOUNT }}
          workload_identity_provider: ${{ secrets.GOOGLE_WORKLOAD_IDENTITY_PROVIDER }}
      - uses: r7kamura/google-docs-to-markdown@v0
        with:
          google_drive_folder_id: ${{ secrets.GOOGLE_DRIVE_FOLDER_ID }}
```

## Inputs

### `google_drive_folder_id`

ID of the Google Drive folder to be exported. Folder ID is contained in the trailing part of the folder's URL.

- required

### `output_directory_path`

Directory path to output files.

- optional
- default: `"output"`
