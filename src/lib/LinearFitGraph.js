// Version 1.0 (c) John Murphy 20th-Oct-2019
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
 * @param {String} title Window title
 * @param {Number function(SamplePair)} getX
 * @param {Number function(SamplePair)} getY
 * @returns {Graph}
 */
function Graph(title, getX, getY) {
    this.title = title;
    this.getX = getX;
    this.getY = getY;

    /**
     * Get colour of line / point from channel number.
     * @param {Number} channel
     * @param {Number} nChannels
     * @returns {Number} Colour channel (0=R, 1=G, 2=B)
     */
    this.getColor = function (channel, nChannels){
        if (nChannels === 4){
            // CFA pattern
            switch (channel){
                case 0:
                    // Red
                    return 0;
                case 1:
                    // Green
                    return 1;
                case 2:
                    // Green
                    return 1;
                case 3:
                    // Blue
                    return 2;
            }
        }
        // Not CFA pattern. 
        return channel;
    };
    
    /**
     * Create and display graph
     * @param {ImageWindow} window
     * @param {Number} nChannels
     * @param {LinearFit[]} linearFit
     * @param {SamplePair[][]} colorSamplePairArray for each channel
     * @returns {undefined}
     */
    this.displayGraphWindow = function (window, nChannels, linearFit, colorSamplePairArray) {
        let view = window.mainView;
        let image = view.image;
        view.beginProcess();
        for (let channel = 0; channel < nChannels; channel++) {
            let colour = this.getColor(channel, nChannels);
            this.drawLine(linearFit[channel].m, linearFit[channel].b, image, colour);
        }
        // Draw points on top of lines
        for (let channel = 0; channel < nChannels; channel++) {
            let colour = this.getColor(channel, nChannels);
            this.drawPoints(colorSamplePairArray[channel], image, colour);
        }
        view.endProcess();
        window.show();
    };

    /**
     * Creates a new empty Graph window. Private function.
     * @param {SamplePair[][]} colorSamplePairArray for each channel
     * @param {Number} nChannels
     * @param {Number} maxWindowSize maximum window height and width
     * @returns {ImageWindow}
     */
    this.createLinearFitWindow = function (colorSamplePairArray, nChannels, maxWindowSize) {
        let maxX = 0;
        let maxY = 0;
        // Calculate maxX and maxY
        for (let channel=0; channel<nChannels; channel++) {
            colorSamplePairArray[channel].forEach(function (samplePair){
                maxX = Math.max(maxX, getX(samplePair));
                maxY = Math.max(maxY, getY(samplePair));
            });
        }
        if (maxX > maxY) {
            this.graphWidth = maxWindowSize;
            this.graphHeight = 1 + Math.ceil(maxWindowSize * maxY / maxX);
            this.scaleX = (this.graphWidth - 5) / maxX;
            this.scaleY = this.scaleX;
        } else {
            this.graphHeight = maxWindowSize;
            this.graphWidth = 1 + Math.ceil(maxWindowSize * maxX / maxY);
            this.scaleY = (this.graphHeight - 5) / maxY;
            this.scaleX = this.scaleY;
        }
        this.zeroYCoord = this.graphHeight - 1;

        const SAMPLE_TYPE_FLOAT = true;
        let bitsPerSample = 8;
        let sampleType = !SAMPLE_TYPE_FLOAT;
        let color = nChannels > 1;

        return new ImageWindow(this.graphWidth, this.graphHeight,
                Math.min(nChannels, 3), bitsPerSample, sampleType, color, this.title);
    };
    
    /**
     * Creates a new empty Graph window. Private function.
     * @param {SamplePair[][]} colorSamplePairArray for each channel
     * @param {Number} nChannels
     * @param {Number} graphWidth 
     * @returns {ImageWindow}
     */
    this.createGradientFitWindow = function (colorSamplePairArray, nChannels, graphWidth) {
        this.graphHeight = 500;
        this.graphWidth = graphWidth;
        // Find max difference
        let maxDif = Number.NEGATIVE_INFINITY;
        let minDif = Number.POSITIVE_INFINITY;
        for (let channel = 0; channel < nChannels; channel++){
            for (let samplePair of colorSamplePairArray[channel]){
                // works for both horizontal and vertical
                minDif = Math.min(minDif, getY(samplePair));
                maxDif = Math.max(maxDif, getY(samplePair));
            }
        }
        this.scaleX = 1;
        this.scaleY = (this.graphHeight - 10) / (maxDif - minDif);
        this.zeroYCoord = this.graphHeight - 1 + (minDif * this.scaleY);
        if (this.scaleY === Number.POSITIVE_INFINITY || this.scaleY === Number.NEGATIVE_INFINITY){
            this.scaleY = 1.0;
        }
        
        const SAMPLE_TYPE_FLOAT = true;
        let bitsPerSample = 8;
        let sampleType = !SAMPLE_TYPE_FLOAT;
        let color = nChannels > 1;
        return new ImageWindow(this.graphWidth, this.graphHeight,
                nChannels, bitsPerSample, sampleType, color, this.title);
    };
    
    /**
     * Create and display gradient graph
     * @param {ImageWindow} window
     * @param {Number} nChannels
     * @param {Number[].GradientData} gradientArray
     * @param {SamplePair[][]} colorSamplePairArray for each channel
     * @returns {undefined}
     */
    this.displayGradientGraphWindow = function (window, nChannels, gradientArray, colorSamplePairArray) {
        let view = window.mainView;
        let image = view.image;
        view.beginProcess();
        for (let channel = 0; channel < nChannels; channel++) {
            let colour = this.getColor(channel, nChannels);
            this.drawGradientLine(gradientArray, image, colour);
        }
        // Draw points on top of lines
        for (let channel = 0; channel < nChannels; channel++) {
            let colour = this.getColor(channel, nChannels);
            this.drawPoints(colorSamplePairArray[channel], image, colour);
        }
        view.endProcess();
        window.show();
    };

    /**
     * 
     * @param {Number[].GradientData} gradientArray
     * @param {Image} image
     * @param {Number} channel
     * @returns {undefined}
     */
    this.drawGradientLine = function(gradientArray, image, channel){
        const LINE_INTENSITY = 0.4;
        for (let x = 0; x < this.graphWidth; x++) {
            let y = Math.round(gradientArray[channel].difArray[x] * this.scaleY);
            let yScreen = this.zeroYCoord - y;
            if (yScreen >= 0 && yScreen < this.graphHeight) {
                image.setSample(LINE_INTENSITY, x, yScreen, channel);
            }
        }
    };

    /**
     * @param {number} m Gradient of line
     * @param {number} b Line y axis intercept
     * @param {Image} image
     * @param {number} channel
     * @returns {undefined}
     */
    this.drawLine = function (m, b, image, channel) {
        const LINE_INTENSITY = 0.4;
        for (let x = 0; x < this.graphWidth; x++) {
            let y = m * x;
            y = y * (this.scaleY / this.scaleX) + (b * this.scaleY);
            y = Math.round(y);
            let yScreen = this.zeroYCoord - y;
            if (yScreen >= 0 && yScreen < this.graphHeight) {
                image.setSample(LINE_INTENSITY, x, yScreen, channel);
            }
        }
    };

    /**
     *
     * @param {SamplePair[]} samplePairArray
     * @param {Image} image
     * @param {Number} channel
     * @returns {undefined}
     */
    this.drawPoints = function (samplePairArray, image, channel) {
        let graphScaleX = this.scaleX;
        let graphScaleY = this.scaleY;
        let graphW = this.graphWidth;
        let graphH = this.graphHeight;
        let zeroY = this.zeroYCoord;
        samplePairArray.forEach(function (samplePair) {
            let x = Math.round(getX(samplePair) * graphScaleX);
            let y = zeroY - Math.round(getY(samplePair) * graphScaleY);
            if (x < graphW && x >= 0 && y < graphH && y >= 0) {
                // If point on top of line or another point, make it brighter (but not > 1.0)
                let sample = image.sample(x, y, channel);
                let newSampleValue = Math.min(1.0, sample + 0.5);
                image.setSample(newSampleValue, x, y, channel);
            } else {
                console.writeln("Graph point out of range: (", x, ",", y, ") W=", graphW, " H=", graphH);
            }
        });
    };
    
}

/**
 *
 * @param {Number[].SamplePair[]} colorSamplePairArray
 * @param {Number} sampleSize length of square side
 * @param {View} referenceView 
 * @param {String} title
 * @returns {undefined}
 */
function drawSampleSquares(colorSamplePairArray, sampleSize, referenceView, title) {
    
    // If all three colors have a sample in the same place, we need to draw a
    // white square. To do this we create a map. The key is the sample central 
    // coordinate. The value stores a binary number. The first three bits 
    // represent R, G, B
    let sampleMap = new Map();
    let isColor = colorSamplePairArray.length > 1;
    if (isColor){
        for (let color = 0; color < colorSamplePairArray.length; color++) {
            let bitFlag = colorToBitFlag(color);
            let samplePairArray = colorSamplePairArray[color];
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
    for(let i=0; i < colorSamplePairArray.length; i++){
        let samplePairArray = colorSamplePairArray[i];
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
        let samplePairArray = colorSamplePairArray[0];
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
    
    view.beginProcess();
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
     * @param {type} red (0 to 255) << 16
     * @param {type} green (0 to 255) << 8
     * @param {type} blue (0 to 255) 
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
