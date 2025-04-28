export type Env = {
    [K in `BUCKET_${string}`]: R2Bucket;
}

export interface User {
	username: string;
	salted_hash: string;
}
