// src/api/index.js
export { default as api, unwrap } from "./client";

// Datasets
export {
  listDatasets,
  uploadDataset,
  getDatasetSchema,
  getDatasetPreview,
} from "./datasets";

// Analytics
export {
  askQuestion,
  runQuery,
} from "./analytics";

