export type Env = {
    [K in `BUCKET_${string}`]: R2Bucket;
}
