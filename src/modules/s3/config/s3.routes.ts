export const s3Routes = {
	s3: {
		route: 's3',
		tag: 'S3 Storage',
		operation: {
			upload: {
				method: 'POST',
				route: '/upload',
				summary: 'Upload a file to S3 (multipart for files ≥5 MiB, simple PUT otherwise)',
			},
			getSize: {
				method: 'POST',
				route: '/size-total',
				summary: 'Calculate total size of one or more S3 prefixes',
			},
		},
	},
};
