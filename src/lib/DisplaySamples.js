// Version 1.0 (c) John Murphy 16th-Feb-2020
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
 * @param {SamplePairs[]} colorSamplePairs
 * @param {View} referenceView 
 * @param {String} title
 * @returns {ImageWindow} PixInsight window of reference image with sample squares drawn
 */
function drawSampleSquares(colorSamplePairs, referenceView, title) {
    // If all three colors have a sample in the same place, we need to draw a
    // white square. To do this we create a map. The key is the sample central 
    // coordinate. The value stores a binary number. The first three bits 
    // represent R, G, B
    let sampleMap = new Map();
    let isColor = colorSamplePairs.length > 1;
    if (isColor){
        for (let color = 0; color < colorSamplePairs.length; color++) {
            let bitFlag = colorToBitFlag(color);
            let samplePairArray = colorSamplePairs[color].samplePairArray;
            samplePairArray.forEach(function (samplePair) {
                let key = samplePair.x + "," + samplePair.y;
                let value = sampleMap.get(key);
                if (value === undefined) {
                    value = new SampleRectangle(samplePair.x, samplePair.y, bitFlag);
                    sampleMap.set(key, value);
                } else {
                    // The value we are updating is the value stored within the map
                    value.addColorBitFlag(bitFlag);
                }
            });
        }
    }

    let imageWidth = referenceView.image.width;
    let imageHeight = referenceView.image.height;
    let bmp = new Bitmap(imageWidth, imageHeight);
    // AARRGGBB
    bmp.fill(0x00000000);
    let graphics = new Graphics(bmp);
    
    // get brightness range of sample values
    let maxValue = Number.MIN_VALUE;
    let minValue = Number.MAX_VALUE;
    for(let i=0; i < colorSamplePairs.length; i++){
        let samplePairArray = colorSamplePairs[i].samplePairArray;
        samplePairArray.forEach(function (samplePair) {
            let value = samplePair.referenceMean;
            maxValue = Math.max(maxValue, value);
            minValue = Math.min(minValue, value);
        });
    }
    
    let maxValueMinusMinValue = Math.ceil(256 * (maxValue - minValue));
    // Make really sure squares are brighter than background
    let penValue = Math.ceil(256 * maxValue) + maxValueMinusMinValue;
    penValue = Math.min(255, penValue);

    // Draw the samples into a bitmap
    let sampleSize = colorSamplePairs[0].sampleSize;
    let square = new Rect(sampleSize, sampleSize);
    let offset = (sampleSize - 1) / 2;
    if (isColor) {
        let alpha = 128 << 24;
        let red = penValue << 16;
        let green = penValue << 8;
        let blue = penValue;
        for (let sampleRectangle of sampleMap.values()) {
            let hexColor = sampleRectangle.getHexColor(alpha, red, green, blue);
            graphics.pen = new Pen(hexColor); // AARRGGBB e.g 0xFFAABBCC
            let x = sampleRectangle.x - offset;
            let y = sampleRectangle.y - offset;
            square.moveTo(x, y);
            graphics.drawRect(square);
        }
    } else {
        graphics.pen = new Pen((128 << 24) + (penValue << 16) + (penValue << 8) + penValue);
        let samplePairArray = colorSamplePairs[0].samplePairArray;
        samplePairArray.forEach(function (samplePair) {
            let x = samplePair.x - offset;
            let y = samplePair.y - offset;
            square.moveTo(x, y);
            graphics.drawRect(square);
        });
    }
    
    graphics.end();
    
    let bitsPerSample = 32;
    let nChannels = isColor ? 3 : 1;
    let imageWindow = new ImageWindow(imageWidth, imageHeight,
                nChannels, bitsPerSample, true, isColor, title);
    
    let view = imageWindow.mainView;
    let image = view.image;
    
    view.beginProcess(UndoFlag_NoSwapFile);
    image.assign(referenceView.image);
    image.blend(bmp);
    view.endProcess();
    
    return imageWindow;
}

/**
 * @param {Number} color Channel number (0=R, 1=G, 2=B)
 * @returns {Number} bit code for color
 */
function colorToBitFlag(color) {
    return Math.pow(2, color);
}

/**
 * Stores the sample rectangles coordinates and color bit flags
 * @param {Number} x
 * @param {Number} y
 * @param {Number} bitFlag
 * 
 * @returns {SampleRectangle}
 */
function SampleRectangle(x, y, bitFlag) {
    this.x = x;
    this.y = y;
    this.colorBitFlags = bitFlag;

    /**
     * Add specified color bit to the bit flags for this sample square
     * @param {Number} bitFlag 
     * @returns {undefined}
     */
    this.addColorBitFlag = function (bitFlag) {
        this.colorBitFlags += bitFlag;
    };
    
    /**
     * @param {Number} alpha (0 to 255) << 24
     * @param {Number} red (0 to 255) << 16
     * @param {Number} green (0 to 255) << 8
     * @param {Number} blue (0 to 255) 
     * @returns {Number} Hex color AARRGGBB
     */
    this.getHexColor = function (alpha, red, green, blue){
        switch (this.colorBitFlags) {
            case 1: // 001 Red
                return alpha + red;
            case 2: // 010 Green
                return alpha + green;
            case 3: // 011 Green Red
                return alpha + green + red;
            case 4: // 100 Blue
                return alpha + blue;
            case 5: // 101 Blue Red
                return alpha + blue + red;
            case 6: // 110 Blue Green
                return alpha + blue + green;
            case 7: // 111 Blue Green Red
                return alpha + blue + green + red;
        }
        return 0;
    };
}
