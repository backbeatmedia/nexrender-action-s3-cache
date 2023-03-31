const fs = require('fs');
const path = require('path');

const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");

async function findCachedAsset(asset, settings, workpath, client, bucket, key) {
    if (asset.src.startsWith('file://')) {
        settings.logger.log(`> Skipping cache for ${asset.src}; local file protocol is being used`);
        return;
    }

    const fileName = path.basename(asset.src);
    const filePath = path.join(workpath, fileName);

    if (!Boolean(key) && !key.endsWith('/')) key += '/'; // non-blank keys must end with '/'

    try {

        const response = await client.send(new GetObjectCommand({
            Bucket: bucket,
            Key: `${key}${fileName}`
        }));

        settings.logger.log(`> Cached file found at s3://${bucket}/${key}${fileName}`);
        settings.logger.log(`> Old source: ${asset.src}`);

    } catch (err) {
        settings.logger.log('> Asset not found in cache');
        return;
    }

    try {

        const downloadable = await response.Body.transformToStream();
        
        await new Promise((resolve, reject) => {
            downloadable.pipe(fs.createWriteStream(filePath))
                .on('error', err => reject(err))
                .on('close', () => resolve())
        })

        asset.src = `file://${filePath}`;
        settings.logger.log(`> New source: ${asset.src}`);

    } catch (err) {
        settings.logger.log('> cache restore attempt unsuccessful');
    }

}

const predownload = async (job, settings, { config, key, bucket }) => {

    // connect to S3
    const client = new S3Client(config);

    // add self to post-download actions
    if (!job.postdownload) job.postdownload = [];
    job.postdownload.push(
        {
            "module": __filename,
            "config": config,
            "bucket": bucket,
            "key": key
        }
    );

    // Job template
    await findCachedAsset(job.template, settings, job.workpath, client, bucket, key);

    // Job assets
    for (const asset of job.assets) {
        // Only asset types that can be downloaded files
        if (['image', 'audio', 'video', 'script', 'static'].includes(asset.type)) {
            await findCachedAsset(asset, settings, job.workpath, client, bucket, key);
        }
    }

    client.destroy();

}

async function saveCache(asset, settings, workpath, client, bucket, key) {
    if (asset.src.startsWith('file://')) {
        settings.logger.log(`> Skipping cache for ${asset.src}; local file protocol is being used`);
        return;
    }

    const fileName = path.basename(asset.src);
    const from = path.join(workpath, fileName);

    if (!Boolean(key) && !key.endsWith('/')) key += '/'; // non-blank keys must end with '/'

    settings.logger.log(`> Saving from ${from} to s3://${bucket}/${key}${fileName}`);

    try {

        await client.send(new PutObjectCommand({
            Body: from,
            Bucket: bucket,
            Key: `${key}${fileName}`
        }));

    } catch (err) {
        settings.logger.log('> Save unsuccessful');
    }
}

const postdownload = async (job, settings, { config, key, bucket }) => {

    // connect to S3
    const client = new S3Client(config);

    // Job template
    await saveCache(job.template, settings, job.workpath, client, bucket, key);

    // Job assets
    for (const asset of job.assets) {
        // Only asset types that can be downloaded files
        if (['image', 'audio', 'video', 'script', 'static'].includes(asset.type)) {
            await saveCache(asset, settings, job.workpath, client, bucket, key);
        }
    }

    client.destroy();
}

module.exports = (job, settings, { config, key, bucket }, type) => {

    if (!config || !config.region || !bucket) throw new Error("S3 parameters insufficient.");

    if (!key) key=""; // optional key - defaults to bucket root, denoted by blank string

    if (type === 'predownload') return predownload(job, settings, { config, key, bucket }, type);
    
    if (type === 'postdownload') return postdownload(job, settings, { config, key, bucket }, type);
    
    return Promise.resolve();
}