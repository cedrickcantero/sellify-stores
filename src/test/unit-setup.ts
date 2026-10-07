// Runs in every unit worker before its test file is imported. Unit tests are
// pure and must never reach a database or external service, so the
// connection settings are removed even if the shell exported them.
for (const name of ["DATABASE_URL", "TEST_DATABASE_URL", "BLOB_READ_WRITE_TOKEN"]) {
  delete process.env[name];
}
