// Version 1.0 (c) John Murphy 22nd-April-2020
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

/**
 * @param {Image} image
 * @returns {Rect} Bounding box of non zero pixels
 */
function getBoundingBox(image){
    const width = image.width;
    const height = image.height;
    const nChannels = image.isColor ? 3 : 1;
    let startP = image.maximumPosition();
    let x0 = 0;
    let x1 = image.width;
    let y0 = 0;
    let y1 = image.height;
    
    // Find the approximate edges
    let y = startP.y;
    for (let x = startP.x; x >= 0; x--){
        if (0 === image.sample(x, y)){
            x0 = Math.min(x + 1, width);
            break;
        }
    }
    for (let x = startP.x; x < width; x++){
        if (0 === image.sample(x, y)){
            x1 = x;
            break;
        }
    }
    let x = startP.x;
    for (let y = startP.y; y >= 0; y--){
        if (0 === image.sample(x, y)){
            y0 = Math.min(y + 1, height);
            break;
        }
    }
    for (let y = startP.y; y < height; y++){
        if (0 === image.sample(x, y)){
            y1 = y;
            break;
        }
    }
    
    // Refine to accurate bounding box
    let row = new Rect(width, 1);
    for (; y0 > 0; y0--){
        row.translate(0, y0 - 1);
        if (isLineBlack(image, row, nChannels)){
            break;
        }
    }
    for (; y1 < height; y1++){
        row.translate(0, y1);
        if (isLineBlack(image, row, nChannels)){
            break;
        }
    }
    let col = new Rect(1, height);
    for (; x0 > 0; x0--){
        col.translate(x0 - 1, 0);
        if (isLineBlack(image, col, nChannels)){
            break;
        }
    }
    for (; x1 < height; x1++){
        col.translate(x1, 0);
        if (isLineBlack(image, col, nChannels)){
            break;
        }
    }
    return new Rect(x0, y0, x1, y1);
}

/**
 * @param {Image} image Target image
 * @param {Rect} rect Rectangle that represents a single pixel row or column
 * @param {Number} nChannels 1 for B&W, 3 for color
 * @returns {Boolean} Return true if all pixels in rect are black
 */
function isLineBlack(image, rect, nChannels){
    for (let c=0; c<nChannels; c++){
        let samples = [];
        image.getSamples(samples, rect, c);
        for (let sample of samples){
            if (sample !== 0){
                return false;
            }
        }
    }
    return true;
}

/**
 * @param {Image} image Target image
 * @param {Rect} overlap Area of Interest Preview rectangle
 * @param {Number} nChannels 1 for B&W, 3 for color
 * @returns {Boolean} True if the target image is below the reference image
 */
function isImageBelowOverlap(image, overlap, nChannels){
    const height = image.height;
    for (let offset = 0; ;offset++){
        let y = overlap.y0 - offset;
        let line = new Rect(overlap.x0, y, overlap.x1, y + 1);
        if (y === 0 || isLineBlack(image, line, nChannels)){
            return true;
        }
        y = overlap.y1 + offset;
        line = new Rect(overlap.x0, y, overlap.x1, y + 1);
        if (y === height || isLineBlack(image, line, nChannels)){
            return false;
        }
    }
}

/**
 * 
 * @param {Image} image Target image
 * @param {Rect} overlap Area of Interest Preview rectangle
 * @param {Number} nChannels 1 for B&W, 3 for color
 * @returns {Boolean} True if the target image is to right of the reference image
 */
function isImageRightOfOverlap(image, overlap, nChannels){
    const width = image.width;
    for (let offset = 0; ;offset++){
        let x = overlap.x0 - offset;
        let line = new Rect(x, overlap.y0, x + 1, overlap.y1);
        if (x === 0 || isLineBlack(image, line, nChannels)){
            return true;
        }
        x = overlap.x1 + offset;
        line = new Rect(x, overlap.y0, x + 1, overlap.y1);
        if (x === width || isLineBlack(image, line, nChannels)){
            return false;
        } 
    }
}

/**
 * Extend the subRect rectangle in the specified direction to the superRect size
 * @param {Rect} subRect Small rectangle (not modified)
 * @param {Rect} superRect Large rectangle (not modified)
 * @param {Rect} isHorizontal extend small rectangle in this direction
 * @returns {Rect} The extended subRect
 */
function extendSubRect(subRect, superRect, isHorizontal){
    if (isHorizontal){
        return new Rect(superRect.x0, subRect.y0, superRect.x1, subRect.y1);
    }
    return new Rect(subRect.x0, superRect.y0, subRect.x1, superRect.y1);
}
