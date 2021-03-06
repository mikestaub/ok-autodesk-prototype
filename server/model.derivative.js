'use strict'; // http://www.w3schools.com/js/js_strict.asp

// token handling in session
var token = require('./token');

// web framework
var express = require('express');
var router = express.Router();

var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();

var zlib = require("zlib");

var forgeMD = require('forge-model-derivative');

/////////////////////////////////////////////////////////////////
// Get the list of export file formats supported by the
// Model Derivative API
/////////////////////////////////////////////////////////////////
function getForgeMD(req, res) {
    var tokenSession = new token(req.session);
    forgeMD.ApiClient.instance.authentications ['oauth2_access_code'].accessToken =
        tokenSession.getTokenInternal();

    if (!tokenSession.isAuthorized()) {
        res.status(401).json({error: 'Please login first'});
        return null;
    }

    return new forgeMD.DerivativesApi();
}

/////////////////////////////////////////////////////////////////
// Get the list of export file formats supported by the
// Model Derivative API
/////////////////////////////////////////////////////////////////
router.get('/formats', function (req, res) {
    var derivatives = getForgeMD(req, res);
    if (!derivatives)
        return;

    derivatives.getFormats()
        .then(function (formats) {
            res.json(formats);
        })
        .catch(function (error) {
            res.status(error.statusCode).end(error.statusMessage);
        });
});

/////////////////////////////////////////////////////////////////
// Get the manifest of the given file. This will contain
// information about the various formats which are currently
// available for this file
/////////////////////////////////////////////////////////////////
router.get('/manifests/:urn', function (req, res) {
    var derivatives = getForgeMD(req, res);
    if (!derivatives)
        return;

    derivatives.getManifest(req.params.urn)
        .then(function (data) {
            res.json(data);
        })
        .catch(function (error) {
            res.status(error.statusCode).end(error.statusMessage);
        });
});

router.delete('/manifests/:urn', function (req, res) {
    try {
        var derivatives = getForgeMD(req, res);
        if (!derivatives)
            return;

        derivatives.deleteManifest(req.params.urn)
            .then(function (data) {
                res.json(data);
            })
            .catch(function (error) {
                res.status(error.statusCode).end(error.statusMessage);
            });
    } catch (ex) {
        console.log('problem with /manifests/:urn delete');
        var txt = ex;
    }
});

/////////////////////////////////////////////////////////////////
// Get the metadata of the given file. This will provide us with
// the guid of the avilable models in the file
/////////////////////////////////////////////////////////////////
router.get('/metadatas/:urn', function (req, res) {
    var derivatives = getForgeMD(req, res);
    if (!derivatives)
        return;

    derivatives.getMetadata(req.params.urn)
        .then(function (data) {
            res.json(data);
        })
        .catch(function (error) {
            res.status(error.statusCode).end(error.statusMessage);
        });
});

/////////////////////////////////////////////////////////////////
// Get the hierarchy information for the model with the given
// guid inside the file with the provided urn
/////////////////////////////////////////////////////////////////
router.get('/hierarchy', function (req, res) {
    var derivatives = getForgeMD(req, res);
    if (!derivatives)
        return;

    derivatives.getModelviewMetadata(req.query.urn, req.query.guid)
        .then(function (metaData) {
            // For some reason the result=accepted reply comes back
            // as garbage: �       �V*J-.�)Q�R*.MNN-.V� &��o   
            // and so this is the workaround
            if (metaData.data) {
                res.json(metaData);
            } else {
                res.json({result: 'accepted'});
            }
        })
        .catch(function (error) {
            res.status(error.statusCode).end(error.statusMessage);
        });
});

/////////////////////////////////////////////////////////////////
// Get the properties for all the components inside the model
// with the given guid and file urn
/////////////////////////////////////////////////////////////////
router.get('/properties', function (req, res) {
    var derivatives = getForgeMD(req, res);
    if (!derivatives)
        return;

    derivatives.getModelviewProperties(req.query.urn, req.query.guid)
        .then(function (data) {
            res.json(data);
        })
        .catch(function (error) {
            res.status(error.statusCode).end(error.statusMessage);
        });
});

/////////////////////////////////////////////////////////////////
// Download the given derivative file, e.g. a STEP or other
// file format which are associated with the model file
/////////////////////////////////////////////////////////////////
router.get('/download', function (req, res) {
    var derivatives = getForgeMD(req, res);
    if (!derivatives)
        return;

    derivatives.getDerivativeManifest(req.query.urn, req.query.derUrn)
        .then(function (data) {
            var fileExt = req.query.fileName.split('.')[1];
            res.set('content-type', 'application/' + fileExt);
            res.set('Content-Disposition', 'attachment; filename="' + req.query.fileName + '"');
            res.end(data);
        })
        .catch(function (error) {
            res.status(error.statusCode).end(error.statusMessage);
        });
});

/////////////////////////////////////////////////////////////////
// Send a translation request in order to get an SVF or other
// file format for our file
/////////////////////////////////////////////////////////////////
router.post('/export', jsonParser, function (req, res) {
    //env, token, urn, format, rootFileName, fileExtType, advanced
    var item = {
        "type": req.body.format
    };

    if (req.body.format === 'svf') {
        item.views = ['2d', '3d'];
    }

    if (req.body.advanced) {
        item.advanced = req.body.advanced;
    }

    var input = (req.body.fileExtType && req.body.fileExtType === 'versions:autodesk.a360:CompositeDesign' ? {
        "urn": req.body.urn,
        "rootFilename": req.body.rootFileName,
        "compressedUrn": true
    } : {"urn": req.body.urn});
    var output = {
        "destination": {
            "region": "us"
        },
        "formats": [item]
    };

    var derivatives = getForgeMD(req, res);
    if (!derivatives)
        return;

    derivatives.translate({"input": input, "output": output})
        .then(function (data) {
            res.json(data);
        })
        .catch(function (error) {
            res.status(error.statusCode).end(error.statusMessage);
        });
});

/////////////////////////////////////////////////////////////////
// Return the router object that contains the endpoints
/////////////////////////////////////////////////////////////////
module.exports = router;