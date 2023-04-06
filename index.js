const fs = require('fs');
const path = require('path');

const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");

async function findCachedAsset(asset, settings, workpath, client, bucket, key) {
    if (asset.src.startsWith('file://')) {
        settings.logger.log(`> Skipping cache for ${asset.src}; local file protocol is being used`);
        return;
    }

    // what will thect object be called on s3,if it's there?
    const objectName = encodeURI(asset.src);

    // where should it be stored locally (using code from the download module)?
    destName = path.basename(asset.src)
    destName = destName.indexOf('?') !== -1 ? destName.slice(0, destName.indexOf('?')) : destName;
    /* ^ remove possible query search string params ^ */
    destName = decodeURI(destName) /* < remove/decode any special URI symbols within filename */

    const filePath = path.join(workpath, destName);

    let getObjectResponse;

    if (Boolean(key) && !key.endsWith('/')) key += '/'; // non-blank keys must end with '/'
    // console.log(`key = '${key}`);

    try {

        getObjectResponse = await client.send(new GetObjectCommand({
            Bucket: bucket,
            Key: `${key}${objectName}`
        }));

        settings.logger.log(`> Cached file found at s3://${bucket}/${key}${objectName}`);
        settings.logger.log(`> Old source: ${asset.src}`);

    } catch (err) {
        settings.logger.log('> Asset not found in cache');
        //settings.logger.log(`> ${err.stack}`); // there will always be an error here; this is expected behaviour on asset not found
        return;
    }

    try {

        const downloadable = await getObjectResponse.Body;

        await new Promise((resolve, reject) => {
            downloadable.pipe(fs.createWriteStream(filePath))
                .on('error', err => reject(err))
                .on('close', () => resolve())
        })

        asset.src = `file://${filePath}`;
        settings.logger.log(`> New source: ${asset.src}`);

    } catch (err) {
        settings.logger.log('> cache restore attempt unsuccessful');
        settings.logger.log(`> ${err.stack}`);
    }

}

const predownload = async (job, settings, { config, key, bucket }) => {

    // connect to S3
    const client = new S3Client(config);

    // add self to post-download actions
    if (!job.actions.postdownload) job.actions.postdownload = [];
    job.actions.postdownload.push(
        {
            'module': __filename,
            'config': config,
            'bucket': bucket,
            'key': key
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

    // encode a name for the file at rest on S3
    const objectName = encodeURI(asset.src);

    // locate the local file and make a stream
    const blob = fs.readFileSync(asset.dest)

    if (Boolean(key) && !key.endsWith('/')) key += '/'; // non-blank keys must end with '/'

    settings.logger.log(`> Saving from ${path.basename(asset.dest)} to s3://${bucket}/${key}${objectName}`);

    try {

        await client.send(new PutObjectCommand({
            Body: blob,
            Bucket: bucket,
            Key: `${key}${objectName}`
        }));

    } catch (err) {
        settings.logger.log('> Save unsuccessful');
        settings.logger.log(`> ${err.stack}`);
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

    if (!Boolean(key)) var key = ""; // optional key - defaults to bucket root, denoted by blank string

    if (type === 'predownload') return predownload(job, settings, { config, key, bucket }, type);

    if (type === 'postdownload') return postdownload(job, settings, { config, key, bucket }, type);

    return Promise.resolve();
}