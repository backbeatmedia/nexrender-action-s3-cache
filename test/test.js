const s3cache = require('./../index.js');
const path = require('path');
const fs = require('fs');

const testrun = async () => {

    let job = {
        "template": {
            "src": "http://fake.domain.com/template.txt",
        },
        "assets": [
            {
                "src": "http://fake.domain.com/asset.txt",
                "type": "static",
            }
        ],
        "predownload": [],
        'postdownload': [],
        'workpath': __dirname
    }

    let settings = {
        logger: console
    };

    let params = {
        "module": "nexrender-action-s3-cache",
        "config": {
            "region": "eu-west-1"
        },
        'key': 'test/key',
        'bucket': 'bkbt-renderkit-uploads'
    };

    // predownload

    await s3cache(job, settings, params, 'predownload');

    console.log(JSON.stringify(job));

    await s3cache(job, settings, params, 'postdownload');

}

testrun();