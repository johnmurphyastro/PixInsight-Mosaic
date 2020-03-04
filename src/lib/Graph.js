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
 * @param {Number} xMin
 * @param {Number} yMin
 * @param {Number} xMax
 * @param {Number} yMax
 * @returns {Graph}
 */
function Graph(xMin, yMin, xMax, yMax) {
    
    this.xMin = xMin;
    this.yMin = yMin;
    this.xMax = xMax;
    this.yMax = yMax;
    
    this.bitmap = null;
    
    this.axisColor = 0xFF888888;
    this.xOrigin = 0;
    this.yOrigin = 0;
    
    /**
     * Sets the x & y axis lengths and calculates the scales for both axis
     * @param {Number} xAxisLength
     * @param {Number} yAxisLength
     * @returns {undefined}
     */
    this.setAxisLength = function(xAxisLength, yAxisLength){
        this.xAxisLength = xAxisLength;
        this.yAxisLength = yAxisLength;
        this.xScale = this.calculateScale(this.xAxisLength, this.xMax - this.xMin);
        this.yScale = this.calculateScale(this.yAxisLength, this.yMax - this.yMin);
    };
    
    /**
     * Sets the x axis length and calculates the scale for the x axis
     * The y axis is set to the same scale and the y axis length is calculated
     * @param {Number} xAxisLength
     * @returns {undefined}
     */
    this.setXAxisLength = function(xAxisLength){
        this.xAxisLength = xAxisLength;
        this.xScale = this.calculateScale(this.xAxisLength, this.xMax - this.xMin);
        this.yScale = this.xScale;
        this.yAxisLength = this.calculateAxisLength(this.yScale, this.yMax - this.yMin);
    };
    
    /**
     * Sets the y axis length and calculates the scale for the y axis
     * The x axis is set to the same scale and the x axis length is calculated
     * @param {Number} yAxisLength
     * @returns {undefined}
     */
    this.setYAxisLength = function(yAxisLength){
        this.yAxisLength = yAxisLength;
        this.yScale = this.calculateScale(this.yAxisLength, this.yMax - this.yMin);
        this.xScale = this.yScale;
        this.xAxisLength = this.calculateAxisLength(this.xScale, this.xMax - this.xMin);
    };
    
    /**
     * Calculate axis scale (private function)
     * @param {Number} axisLength
     * @param {Number} range
     * @returns {Number}
     */
    this.calculateScale = function(axisLength, range){
        return (axisLength - 2) / range;
    };
    
    /**
     * Calculate axis length (private function)
     * @param {Number} scale
     * @param {Number} range
     * @returns {Number}
     */
    this.calculateAxisLength = function(scale, range){
        return scale * range + 2;
    };
    
    /** Private function
     * @param {Number} x
     * @returns {Number}
     */
    this.xToScreenX = function (x){
        return Math.round(this.xOrigin + (x - xMin) * this.xScale);
    };
    
    /** Private function
     * @param {Number} y
     * @returns {Number}
     */
    this.yToScreenY = function(y){
        return Math.round(this.yOrigin - (y - yMin) * this.yScale);
    };
    
    this.createGraph = function (xLabel, yLabel) {
        let g = new Graphics();
        let font = g.font;
        let maxNumberLength = font.width("8.88e+88");
        let minDistBetweenTicks = maxNumberLength * 1.3;
        let fontHeight = font.ascent + font.descent;
        let tickLength = 4;
        
        let topMargin = font.ascent + 2;
        let bottomMargin = fontHeight * 2 + tickLength + 10;
        let leftMargin = maxNumberLength + fontHeight + tickLength + 5;
        let rightMargin = maxNumberLength / 2;
        
        this.xOrigin = leftMargin;
        this.yOrigin = topMargin + this.yAxisLength - 1;
       
        let imageWidth = leftMargin + this.xAxisLength + rightMargin;
        let imageHeight = topMargin + this.yAxisLength + bottomMargin;
        this.bitmap = new Bitmap(imageWidth, imageHeight);
        this.bitmap.fill(0xFF000000);    // AARRGGBB
        
        let g = new Graphics(this.bitmap);
        g.transparentBackground = true;
        g.textAntialiasing = true;
        g.pen = new Pen(this.axisColor);
        g.clipRect = new Rect(0, 0, imageWidth, imageHeight);
        this.drawXAxis(g, tickLength, minDistBetweenTicks);
        this.drawYAxis(g, tickLength, minDistBetweenTicks);
        
        this.drawXAxisLabel(g, imageWidth, imageHeight, xLabel);
        g.end(); // necessary before the yLabel bitmap can copied to this.bitmap
        this.drawYAxisLabel(g, imageHeight, yLabel);
    };
    
    /**
     * Create a graph with no axis and margins.
     * This is used to create seperate red, green and blue graphs that can be
     * bitwise ORed together to blend the colors
     * @returns {Graph}
     */
    this.createGraphAreaOnly = function () {
        let newGraph = new Graph(this.xMin, this.yMin, this.xMax, this.yMax);
        newGraph.xAxisLength = this.xAxisLength;
        newGraph.yAxisLength = this.yAxisLength;
        newGraph.xScale = this.xScale;
        newGraph.yScale = this.yScale;

        newGraph.yOrigin = this.yAxisLength - 1;
        newGraph.bitmap = new Bitmap(this.xAxisLength, this.yAxisLength);
        newGraph.bitmap.fill(0x00000000);    // AARRGGBB
        return newGraph;
    };
    
    /**
     * Perform a bitwise OR on this graph and the input graph.
     * The input graph should have been created without axis (Graph.createGraphAreaOnly).
     * This graph can be a full graph or a graph without axis.
     * This method is typically used to merge three graphs that each supply only one color
     * @param {Graph} graphAreaOnly A graph created without axis
     * @returns {undefined}
     */
    this.mergeWithGraphAreaOnly = function (graphAreaOnly){
        let p = new Point(this.xOrigin, this.yOrigin - this.yAxisLength);
        this.bitmap.or(p, graphAreaOnly.bitmap);
    };
    
    /**
     * @param {Number} m gradient
     * @param {Number} b Y-Axis intercept
     * @param {type} color Line color (0xAARRGGBB)
     * @returns {undefined}
     */
    this.drawLine = function(m, b, color){
        this.drawLineSegment(m, b, color, false, this.xMin, this.xMax);
    };
    
    this.drawLineSegment = function(m, b, color, antiAlias, x0, x1){
        let g = new Graphics(this.bitmap);
        g.clipRect = new Rect(this.xOrigin, this.yOrigin - this.yAxisLength, this.xOrigin + this.xAxisLength, this.yOrigin);
        g.transparentBackground = true;
        g.antialiasing = antiAlias;
        g.pen = new Pen(color);
        let y0 = eqnOfLineCalcY(x0, m, b);
        let y1 = eqnOfLineCalcY(x1, m, b);
        g.drawLine(this.xToScreenX(x0), this.yToScreenY(y0),
            this.xToScreenX(x1), this.yToScreenY(y1));
        g.end();
    };
    
    this.drawPoint = function(xWorld, yWorld, color){
        let x = this.xToScreenX(xWorld);
        let y = this.yToScreenY(yWorld);
        if (x >= 0 && y >= 0 && x < this.bitmap.width && y < this.bitmap.height){
            this.bitmap.setPixel(x, y, color);
        } else {
            Console.criticalln("Out of range: (" + x + "," + y + ") bitmap width: "
                    + this.bitmap.width + " heigth: " + this.bitmap.height);
        }
    };
    
    /**
     * @param {String} title
     * @param {Boolean} isColor
     * @returns {ImageWindow|Graph.createWindow.imageWindow}
     */
    this.createWindow = function (title, isColor) {
        let bitsPerSample = 32;
        let nChannels = isColor ? 3 : 1;
        let imageWindow = new ImageWindow(this.bitmap.width, this.bitmap.height,
                nChannels, bitsPerSample, true, isColor, title);

        let view = imageWindow.mainView;
        let image = view.image;

        view.beginProcess(UndoFlag_NoSwapFile);
        image.blend(this.bitmap);
        view.endProcess();

        return imageWindow;
    };
    
    /**
     * Private function
     * @param {Graphics} g
     * @param {Number} tickLength
     * @param {Number} minDistBetweenTicks
     * @returns {undefined}
     */
    this.drawXAxis = function (g, tickLength, minDistBetweenTicks){
        g.drawLine(this.xOrigin, this.yOrigin, this.xOrigin + this.xAxisLength, this.yOrigin);
        let fontHeight = g.font.ascent + g.font.descent;
        let xTickInterval = calculateTickIncrement(this.xMax - this.xMin, this.xAxisLength / minDistBetweenTicks);
        let firstTickX = calculateFirstTick(this.xMin, xTickInterval);
        for (let x = firstTickX; x <= this.xMax; x += xTickInterval){
            let x1 = this.xToScreenX(x);
            let y1 = this.yOrigin;
            g.drawLine(x1, y1, x1, y1 + tickLength);
            if (xTickInterval < 1){
                let n = Math.abs(x) > 1e-15 ? x : 0;
                let text = n.toExponential(2);
                let width = g.font.width(text);
                g.drawText(x1 - width/2, y1 + tickLength + g.font.ascent + 2, text);
            } else {
                let text = "" + x;
                let width = g.font.width(text);
                g.drawText(x1 - width/2, y1 + tickLength + fontHeight + 2, text);
            }
        }
    };
    
    /**
     * Private function
     * @param {Graphics} g
     * @param {Number} tickLength
     * @param {Number} minDistBetweenTicks
     * @returns {undefined}
     */
    this.drawYAxis = function (g, tickLength, minDistBetweenTicks){
        g.drawLine(this.xOrigin, this.yOrigin, this.xOrigin, this.yOrigin - this.yAxisLength);
        let yTickInterval = calculateTickIncrement(this.yMax - this.yMin, this.yAxisLength / minDistBetweenTicks);
        let firstTickY = calculateFirstTick(this.yMin, yTickInterval);
        for (let y = firstTickY; y <= this.yMax; y += yTickInterval){
            let x1 = this.xOrigin;
            let y1 = this.yToScreenY(y);
            g.drawLine(x1, y1, x1 - tickLength, y1);
            if (yTickInterval < 1){
                let n = Math.abs(y) > 1e-15 ? y : 0;
                let text = n.toExponential(2);
                let width = g.font.width(text);
                g.drawText(x1 - (tickLength + width + 3), y1 + g.font.ascent/2 - 1, text);
            } else {
                let text = "" + y;
                let width = g.font.width(text);
                g.drawText(x1 - (tickLength + width + 3), y1 + g.font.ascent/2 - 1, text);
            }
        }
    };
    
    /**
     * Private function
     * @param {Graphics} g
     * @param {Number} imageWidth
     * @param {Number} imageHeight
     * @param {String} text
     * @returns {undefined}
     */
    this.drawXAxisLabel = function (g, imageWidth, imageHeight, text){
        let x = imageWidth/2 - g.font.width(text)/2;
        let y = imageHeight - 5;
        g.drawText(x, y, text);
    };
    
    /**
     * Private function
     * @param {Graphics} g
     * @param {Number} imageHeight
     * @param {String} text
     * @returns {undefined}
     */
    this.drawYAxisLabel = function (g, imageHeight, text){
        // draw into a small bitmap
        // rotate the bit map by 90 degrees
        // copy bitmap into graph right hand margin
        let w = Math.min(imageHeight, g.font.width(text));
        let h = g.font.ascent + g.font.descent;
        let textBitmap = new Bitmap(w, h);
        textBitmap.fill(0x00000000);    // AARRGGBB
        let graphics = new Graphics(textBitmap);
        graphics.clipRect = new Rect(0, 0, w, h);
        graphics.transparentBackground = true;
        graphics.textAntialiasing = true;
        graphics.pen = new Pen(this.axisColor);
        graphics.drawText(0, h - g.font.descent, text);
        graphics.end();
        let rotatedBitmap = textBitmap.rotated(-Math.PI/2);
        let y = Math.max(0, imageHeight/2 - w/2);
        this.bitmap.copy(new Point(0, y), rotatedBitmap);
    };
    
    // Default the size and scale of the graph
    this.xAxisLength = 700;
    this.yAxisLength = 700;
    this.setAxisLength(this.xAxisLength, this.yAxisLength);
}

/**
 * Private function
 * @param {Number} range xMax - xMin
 * @param {Number} nTargetSteps Maximum number of ticks on axis
 * @returns {Number} tick increment
 */
function calculateTickIncrement(range, nTargetSteps) {
    // calculate the exact floating point step size
    let floatStep = range / nTargetSteps;

    // get the magnitude of the step size (e.g. 999 -> 100, 100 -> 100)
    let nDigits = Math.floor(Math.log10(floatStep)); // e.g. 999 -> 2, 100 -> 2
    let roundDownStep = Math.pow(10, nDigits); // e.g. 2 -> 100

    // calculate how much bigger the floating point step was
    let correctionFactor = Math.round(floatStep / roundDownStep);

    // Adjust our roundDownStep to be closer to the roundDownStep
    if (correctionFactor > 5)
        correctionFactor = 10;
    else if (correctionFactor > 2)
        correctionFactor = 5;
    else if (correctionFactor > 1)
        correctionFactor = 2;

    return correctionFactor * roundDownStep;
}

/**
 * Private function
 * @param {type} minValue xMin
 * @param {type} tickIncrement
 * @returns {Number}
 */
function calculateFirstTick(minValue, tickIncrement){
    return tickIncrement * Math.ceil(minValue / tickIncrement);
}

/**
 * @param {Number} m gradient
 * @param {Number} b y axis intercept
 * @param {Number} x0 Line valid from this x coordinate
 * @param {Number} x1 Line valid upto this x coordinate
 * @returns {EquationOfLine}
 */
function EquationOfLine(m, b, x0, x1){
    this.m = m;
    this.b = b;
    this.x0 = x0;
    this.x1 = x1;
    this.y0 = eqnOfLineCalcY(x0, m, b);
    this.y1 = eqnOfLineCalcY(x1, m, b);
    
    /**
     * y = mx + c
     * @param {Number} x coordinate
     * @returns {Number} y coordinate
     */
    this.calcYFromX = function (x){
        return this.m * x + this.b;
    };
}
/**
 * y = mx + c
 * @param {Number} x coordinate
 * @param {Number} m gradient
 * @param {Number} b y-axis intercept
 * @returns {Number} y coordinate
 */
function eqnOfLineCalcY(x, m, b) {
    return m * x + b;
}
function eqnOfLineCalcGradient(x0, y0, x1, y1) {
    return (y1 - y0) / (x1 - x0);
}   
function eqnOfLineCalcYIntercept(x0, y0, m) {
    return y0 - m * x0;
}
