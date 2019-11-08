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
     * Create and display graph
     * @param {ImageWindow} window
     * @param {Number} nChannels
     * @param {LinearFit[]} linearFit
     * @param {SamplePair[][]} samplePairArray for each channel
     * @returns {undefined}
     */
    this.displayGraphWindow = function (window, nChannels, linearFit, samplePairArray) {
        let view = window.mainView;
        let image = view.image;
        view.beginProcess();
        for (let channel = 0; channel < nChannels; channel++) {
            this.drawLine(linearFit[channel].m, linearFit[channel].b, image, channel);
        }
        // Draw points on top of lines
        for (let channel = 0; channel < nChannels; channel++) {
            this.drawPoints(samplePairArray[channel], image, channel);
        }
        view.endProcess();
        window.show();
    };

    /**
     * Creates a new empty Graph window. Private function.
     * @param {SamplePair[][]} samplePairArray for each channel
     * @param {Number} nChannels
     * @param {Number} maxWindowSize maximum window height and width
     * @returns {ImageWindow}
     */
    this.createLinearFitWindow = function (samplePairArray, nChannels, maxWindowSize) {
        let maxX = 0;
        let maxY = 0;
        // Calculate maxX and maxY
        for (let channel=0; channel<nChannels; channel++) {
            samplePairArray[channel].forEach(function (samplePair){
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
                nChannels, bitsPerSample, sampleType, color, this.title);
    };
    
    /**
     * Creates a new empty Graph window. Private function.
     * @param {SamplePair[][]} samplePairArray for each channel
     * @param {Number} nChannels
     * @param {Number} graphWidth 
     * @returns {ImageWindow}
     */
    this.createGradientFitWindow = function (samplePairArray, nChannels, graphWidth) {
        this.graphHeight = 500;
        this.graphWidth = graphWidth;
        // Find max difference
        let maxDif = Number.NEGATIVE_INFINITY;
        for (let channel = 0; channel < nChannels; channel++){
            for (let samplePair of samplePairArray[channel]){
                // works for both horizontal and vertical
                maxDif = Math.max(maxDif, Math.abs(getY(samplePair)));
            }
        }
        this.zeroYCoord = (this.graphHeight - 1)/2;
        this.scaleX = 1;
        this.scaleY = (this.zeroYCoord - 10) / maxDif;
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
