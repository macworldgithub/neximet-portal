// Stable entry point; imported worker bytes change on each build.
// updateViaCache: 'none' checks this import for new deployments.
importScripts('/sw-build.js');
