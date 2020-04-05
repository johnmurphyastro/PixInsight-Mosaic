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
 * Copy Astrometric solution from source view to target view
 * @param {View} sourceView Copy astrometric solution from this header
 * @param {View} targetView Append astrometric solution to this header
 */
function copyFitsAstrometricSolution(sourceView, targetView) {
    let found = false;
    let keywords = targetView.window.keywords;
    for (let fitsKeyword of sourceView.window.keywords) {
        if (fitsKeyword.name === "COMMENT" &&
                fitsKeyword.comment.toLowerCase().contains("astrometric")) {
            found = true;
            keywords.push(fitsKeyword);
        } 
        if (fitsKeyword.name === "OBJCTRA" ||
                fitsKeyword.name === "OBJCTDEC" ||
                fitsKeyword.name === "EQUINOX" ||
                fitsKeyword.name === "CTYPE1" ||
                fitsKeyword.name === "CTYPE2" ||
                fitsKeyword.name === "CRPIX1" ||
                fitsKeyword.name === "CRPIX2" ||
                fitsKeyword.name === "CRVAL1" ||
                fitsKeyword.name === "CRVAL2" ||
                fitsKeyword.name === "PV1_1" ||
                fitsKeyword.name === "PV1_2" ||
                fitsKeyword.name === "CD1_1" ||
                fitsKeyword.name === "CD1_2" ||
                fitsKeyword.name === "CD2_1" ||
                fitsKeyword.name === "CD2_2" ||
                fitsKeyword.name === "CDELT1" ||
                fitsKeyword.name === "CDELT2" ||
                fitsKeyword.name === "CROTA1" ||
                fitsKeyword.name === "CROTA2"){
            keywords.push(fitsKeyword);
            found = true;
        }
    }
    if (found){
        targetView.window.keywords = keywords;
    }
    return;
}

/**
 * Copy known observaton keywords from source to target fits headers.
 * The RA and DEC are not copied since these will probably be invalid.
 * @param {View} sourceView Copy observation data from this view
 * @param {View} targetView Append observation data to this view
 */
function copyFitsObservation(sourceView, targetView){
    let found = false;
    let keywords = targetView.window.keywords;
    for (let fitsKeyword of sourceView.window.keywords) {
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
                fitsKeyword.name === "DATE-OBS" ||
                fitsKeyword.name === "DATE-END" ||
                fitsKeyword.name === "OBSGEO-H" ||
                fitsKeyword.name === "ALT-OBS"){
            keywords.push(fitsKeyword);
            found = true;
        }
    }
    if (found){
        targetView.window.keywords = keywords;
    }
    return;
}

/**
 * @param {View} view Read FITS header from this view.
 * @param {View} mosaicView Append FITS header to this view.
 * @param {String} startsWith Copy all FITS comments that start with this.
 * @param {String} orStartsWith Copy all FITS comments that start with this.
 */
function copyFitsKeywords(view, mosaicView, startsWith, orStartsWith){
    let modified = false;
    let keywords = view.window.keywords;
    let mosaicKeywords = mosaicView.window.keywords;
    for (let keyword of keywords){
        if (keyword.comment.startsWith(startsWith) || 
                keyword.comment.startsWith(orStartsWith)){
            mosaicKeywords.push(keyword);
            modified = true;
        }
    }
    if (modified){
        mosaicView.window.keywords = mosaicKeywords;
    }
}
