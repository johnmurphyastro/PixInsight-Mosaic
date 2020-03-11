// Version 1.0 (c) John Murphy 10th-March-2020
//
// ======== #license ===============================================================
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the
// Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along with
// this program.  If not, see <http://www.gnu.org/licenses/>.
// =================================================================================
//"use strict";

/**
 * 
 * @param {View} view
 * @param {String[]} comments
 * @param {Boolean} allowUndo
 */
function addFitsHistory(view, comments, allowUndo) {
    let entries = [];
    let keywords = view.window.keywords;
    for (let keyword of keywords){
        let nameValueComment = [3];
        nameValueComment[0] = keyword.name;
        nameValueComment[1] = keyword.value;
        nameValueComment[2] = keyword.comment;
        entries.push(nameValueComment);
    }
    for (let comment of comments){
        let nameValueComment = [3];
        nameValueComment[0] = "HISTORY";
        nameValueComment[1] = "";
        nameValueComment[2] = comment;
        entries.push(nameValueComment);
    }
    let P = new FITSHeader;
    P.keywords = entries;
    P.executeOn(view, allowUndo);
}

/**
 * 
 * @param {View} view
 * @param {String} comment
 */
function addFitsComment(view, comment) {
    let keywords = view.window.keywords;
    keywords.push(new FITSKeyword("COMMENT", "", comment));
    view.window.keywords = keywords;
}

function copyFitsAstrometricSolution(sourceView, targetView) {
    let found = false;
    let keywords = targetView.window.keywords;
    for (let fitsKeyword of sourceView.window.keywords) {
        if (fitsKeyword.name === "COMMENT" &&
                fitsKeyword.comment.toLowerCase().contains("astrometric solution")) {
            found = true;            
        } else if (found && fitsKeyword.name === "HISTORY" && fitsKeyword.name === "COMMENT") {
            // At end of astrometric solution
            break;
        }
        if (found){
            keywords.push(fitsKeyword);
        }
    }
    if (found){
        targetView.window.keywords = keywords;
    }
    return;
}

function copyFitsHistory(sourceView, targetView) {
    let found = false;
    let keywords = targetView.window.keywords;
    for (let fitsKeyword of sourceView.window.keywords) {
        if (fitsKeyword.name === "HISTORY" &&
                !fitsKeyword.comment.startsWith("ImageIntegration.") &&
                !fitsKeyword.comment.startsWith("Integration with ")) {
            found = true;  
            keywords.push(fitsKeyword);
        }
    }
    if (found){
        targetView.window.keywords = keywords;
    }
    return;
}

function getFitsObservation(view){
    let keywords = [];
    for (let fitsKeyword of view.window.keywords) {
        if (fitsKeyword.name === "OBSERVER" ||
                fitsKeyword.name === "INSTRUME" ||
                fitsKeyword.name === "IMAGETYP" ||
                fitsKeyword.name === "FILTER" ||
                fitsKeyword.name === "XPIXSZ" ||
                fitsKeyword.name === "YPIXSZ" ||
                fitsKeyword.name === "XBINNING" ||
                fitsKeyword.name === "YBINNING" ||
                fitsKeyword.name === "TELESCOP" ||
                fitsKeyword.name === "FOCALLEN" ||
                fitsKeyword.name === "OBJECT" ||
                fitsKeyword.name === "RA" ||
                fitsKeyword.name === "DEC" ||
                fitsKeyword.name === "DATE-OBS" ||
                fitsKeyword.name === "DATE-END" ||
                fitsKeyword.name === "OBSGEO-H" ||
                fitsKeyword.name === "ALT-OBS"){
            keywords.push(fitsKeyword);
        }
    }
    return keywords;
}

/**
 * @param {View} view
 * @param {FITSKeyword[]} fitsKeywords
 * @returns {undefined}
 */
function fitsAppendAsComments(view, fitsKeywords){
    let keywords = view.window.keywords;
    for (let fitsKeyword of fitsKeywords){
        let comment = fitsKeyword.name + " : " + fitsKeyword.value + " : " + fitsKeyword.comment;
        keywords.push(new FITSKeyword("COMMENT", "", "__" + comment));
    }
    view.window.keywords = keywords;
}

//let history = [];
//    let prefix = "PhotometricMosaic.";
//    history.push(prefix + "Reference: " + referenceView.fullId);
//    history.push(prefix + "SampleSize: " + data.sampleSize);
//    history.push(prefix + "LineSegments: " + data.nLineSegments);
//    if (data.taperFlag){
//        history.push(prefix + "TaperLength: " + data.taperLength);
//    }
//    for (let c=0; c<nChannels; c++){
//        let starPairs = colorStarPairs[c];
//        history.push(prefix + "Scale[" + c + "]: " + 
//                starPairs.linearFitData.m.toPrecision(5) + " (" + 
//                starPairs.starPairArray.length + " stars)");
//    }
//    addFitsHistory(targetView, history);

// Update Fits Header
//        let mosaicView = View.viewById(mosaicName);
//        if (createMosaicView){
//            copyFitsAstrometricSolution(referenceView, mosaicView);
//            addFitsComment(mosaicView, "PhotometricMosaic " + VERSION());
//            addFitsComment(mosaicView, "MOSAIC TILE: " + referenceView.fullId);
//            let fitsKeywords = getFitsObservation(referenceView);
//            fitsAppendAsComments(mosaicView, fitsKeywords);
//            copyFitsHistory(referenceView, mosaicView);     
//        }
//        
//        addFitsComment(mosaicView, "PhotometricMosaic " + VERSION());
//        addFitsComment(mosaicView, "MOSAIC TILE: " + targetView.fullId);
//        let fitsKeywords = getFitsObservation(targetView);
//        fitsAppendAsComments(mosaicView, fitsKeywords);
//        copyFitsHistory(targetView, mosaicView);
//        let overlayMode;
//        if (data.mosaicOverlayRefFlag)
//            overlayMode = "(" + referenceView.fullId + ") over (" + targetView.fullId + ")";
//        if (data.mosaicOverlayTgtFlag)
//            overlayMode = "(" + targetView.fullId + ") over (" + referenceView.fullId + ")";
//        if (data.mosaicRandomFlag)
//            overlayMode = "Random pixels (" + referenceView.fullId + "), (" + targetView.fullId + ")";
//        if (data.mosaicAverageFlag)
//            overlayMode = "Average (" + referenceView.fullId + "), (" + targetView.fullId + ")";
//        addFitsHistory(mosaicView, [prefix + "Mosaic: " + overlayMode]);

