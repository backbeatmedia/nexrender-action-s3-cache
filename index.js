const fs = require('fs');
const path = require('path');

async function findCachedAsset(asset, settings, cacheDirectory, ttl){
    if (asset.src.startsWith('file://')) {
        settings.logger.log(`> Skipping cache for ${asset.src}; local file protocol is being used`);
        return;
    }

    const fileName = path.basename(asset.src);


    // if file is in S3
    // retrieve it to the workpath
    // change asset source to the file:// location

    settings.logger.log(`> Cached file found at ${maybeCachedFileLocation}`);
    settings.logger.log(`> Old source: ${asset.src}`);
    asset.src = `file://${maybeCachedFileLocation}`;
    settings.logger.log(`> New source: ${asset.src}`);
}

const predownload = async (job, settings, { cacheDirectory, ttl, cacheAssets }) => {
    
    // add self to post-download actions
    
    // Job template
    await findCachedAsset(job.template, settings, cacheDirectory, ttl);


    // Job assets
    for(const asset of job.assets){
        // Only asset types that can be downloaded files
        if(['image', 'audio', 'video', 'script', 'static'].includes(asset.type)){
            await findCachedAsset(asset, settings, cacheDirectory, ttl);
        }
    }

}

async function saveCache(asset, settings, workpath, cacheDirectory){
    if (asset.src.startsWith('file://')) {
        settings.logger.log(`> Skipping cache for ${asset.src}; local file protocol is being used`);
        return;
    }

    if (!fs.existsSync(cacheDirectory)) {
        settings.logger.log(`> Creating cache directory at ${cacheDirectory}`);
        fs.mkdirSync(cacheDirectory);
    }

    const fileName = path.basename(asset.src);
    const from = path.join(workpath, fileName);
    const to = path.join(cacheDirectory, fileName);
    settings.logger.log(`> Copying from ${from} to ${to}`);

    fs.copyFileSync(from, to);
}

const postdownload = async (job, settings, { cacheDirectory, cacheAssets }) => {
    // Job template
    await saveCache(job.template, settings, job.workpath, cacheDirectory);

    // Job assets
    for(const asset of job.assets){
        // Only asset types that can be downloaded files
        if(['image', 'audio', 'video', 'script', 'static'].includes(asset.type)){
            await saveCache(asset, settings, job.workpath, cacheDirectory);
        }
    }

}

module.exports = (job, settings, { params }, type) => {
    if (!params) {
        throw new Error(`S3 parameters not provided.`);
    }

    if (type === 'predownload') {
        return predownload(job, settings, { cacheDirectory, ttl, cacheAssets }, type);
    }

    if (type === 'postdownload') {
        return postdownload(job, settings, { cacheDirectory, cacheAssets }, type);
    }

    return Promise.resolve();
}