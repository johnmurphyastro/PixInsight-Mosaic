/* global UndoFlag_NoSwapFile, Dialog, StdButton_No, StdIcon_Question, StdButton_Cancel, StdButton_Yes */

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
 * Construct the Graph object with the X and Y data range.
 * Calling function must ensure that (xMax - xMin) > 0 and (yMax - yMin) > 0
 * @param {Number} x0 Minimum x value
 * @param {Number} y0 Minimum y value
 * @param {Number} x1 Maximum x value
 * @param {Number} y1 Maximum y value
 * @returns {Graph}
 */
function Graph(x0, y0, x1, y1) {
    this.axisColor = 0xFF888888;
    
    // module data
    let xMin_ = x0;
    let yMin_ = y0;
    let xMax_ = x1;
    let yMax_ = y1;
    
    let bitmap_;
    let xOrigin_;
    let yOrigin_;
    
    let xAxisLength_;
    let yAxisLength_;
    
    let xScale_;
    let yScale_;
    // End of module data
    
    /**
     * Converts screen (x,y) into graph coordinates.
     * @param {Number} x Screen x coordinate
     * @param {Number} y Screen y coordinate
     * @returns {String} Output string in format "( x, y )"
     */
    this.screenToWorld = function( x, y ){
        let wx = (x - xOrigin_) / xScale_ + xMin_;
        let wy = (yOrigin_ - y) / yScale_ + yMin_;
        let xText = wx < 1000 ? wx.toPrecision(3) : wx.toPrecision(4);
        let yText = wy < 1000 ? wy.toPrecision(3) : wy.toPrecision(4);
        return "( " + xText + ", " + yText + " )";
    };
    
    /**
     * Create the graph with fully drawn X-axis and Y-axis.
     * At this stage the graph contains no data.
     * @param {String} xLabel Text to display beneath the X-axis
     * @param {String} yLabel Text to rotate and display on the Y-axis
     * @param {Number} imageWidth Graph width
     * @param {Number} imageHeight Graph height
     * @param {Boolean} preserveAspectRatio If true use same scale for both axis
     */
    this.createGraph = function (xLabel, yLabel, imageWidth, imageHeight, preserveAspectRatio) {
        let g = new Graphics(new Bitmap(1, 1));
        let font = g.font;
        let maxNumberLength = font.width("88.88e+88");
        let minDistBetweenTicks = maxNumberLength * 1.3;
        let fontHeight = font.ascent + font.descent;
        let tickLength = 4;
        let topMargin = font.ascent + 2;
        let bottomMargin = fontHeight * 2 + tickLength + 10;
        let leftMargin = maxNumberLength + fontHeight + tickLength + 5;
        let rightMargin = maxNumberLength / 2;
        
        xAxisLength_ = imageWidth - leftMargin - rightMargin;
        yAxisLength_ = imageHeight - topMargin - bottomMargin;
        this.preferredWidth = imageWidth;
        this.preferredHeight = imageHeight;
        
        xScale_ = calculateScale(xAxisLength_, xMax_ - xMin_);
        yScale_ = calculateScale(yAxisLength_, yMax_ - yMin_);
        if (preserveAspectRatio) {
            xScale_ = yScale_;
            xAxisLength_ = calculateAxisLength(xScale_, xMax_ - xMin_);
            this.preferredWidth = xAxisLength_ + leftMargin + rightMargin;
        }
        
        xOrigin_ = leftMargin;
        yOrigin_ = topMargin + yAxisLength_ - 1;
        
        bitmap_ = new Bitmap(imageWidth, imageHeight);
        bitmap_.fill(0xFF000000);    // AARRGGBB
        
        let graphics;
        try {
            graphics = new Graphics(bitmap_);
            graphics.transparentBackground = true;
            graphics.textAntialiasing = true;
            graphics.clipRect = new Rect(0, 0, imageWidth, imageHeight);
            drawXAxis(graphics, tickLength, minDistBetweenTicks, xLabel, this.axisColor);
            drawYAxis(graphics, tickLength, minDistBetweenTicks, this.axisColor);
        } catch (e) {
            console.criticalln("Graph createGraph error: " + e);
        } finally {
            graphics.end();  
        }
        drawYAxisLabel(font, yLabel, this.axisColor);
        g.end();
    };
    
    /**
     * Create a graph with no axis or margins. It only contains the data area.
     * This is used to create seperate red, green and blue graphs that can be
     * bitwise ORed together to blend the colors
     * @returns {Graph}
     */
    this.createGraphAreaOnly = function () {
        let newGraph = new Graph(xMin_, yMin_, xMax_, yMax_);
        newGraph.setToGraphAreaOnlyMode(xAxisLength_, yAxisLength_, xScale_, yScale_);
        return newGraph;
    };
    
    /**
     * Used to convert a newly constructed Graph into a Graph with only the data area.
     * @param {Number} xLength X-Axis length
     * @param {Number} yLength Y-Axis length
     * @param {Number} scaleX X-Axis scale
     * @param {Number} scaleY Y-Axis scale
     */
    this.setToGraphAreaOnlyMode = function(xLength, yLength, scaleX, scaleY) {
        xAxisLength_ = xLength;
        yAxisLength_ = yLength;
        xScale_ = scaleX;
        yScale_ = scaleY;
        xOrigin_ = 0;
        yOrigin_ = yAxisLength_ - 1;
        bitmap_ = new Bitmap(xAxisLength_, yAxisLength_);
        bitmap_.fill(0x00000000);    // AARRGGBB
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
        let p = new Point(xOrigin_, yOrigin_ - yAxisLength_);
        bitmap_.or(p, graphAreaOnly.getGraphBitmap());
    };
    
    /** Draw a line that traverses the whole data area
     * @param {Number} m gradient
     * @param {Number} b Y-Axis intercept
     * @param {type} color Line color (0xAARRGGBB)
     */
    this.drawLine = function(m, b, color){
        this.drawLineSegment(m, b, color, false, xMin_, xMax_);
    };
    
    /**
     * Draw a line segment which starts from x0 and ends at x1
     * @param {Number} m Line gradient
     * @param {Number} b Y-axis intercept
     * @param {Number} color Hex color value
     * @param {Boolean} antiAlias If true draw an antialiased line
     * @param {Number} x0 Specifies line's left limit
     * @param {Number} x1 Specifies line's right limit
     */
    this.drawLineSegment = function(m, b, color, antiAlias, x0, x1){
        let g;
        try {
            g = new Graphics(bitmap_);
            g.clipRect = new Rect(xOrigin_, yOrigin_ - yAxisLength_, xOrigin_ + xAxisLength_, yOrigin_);
            g.transparentBackground = true;
            g.antialiasing = antiAlias;
            g.pen = new Pen(color);
            let y0 = eqnOfLineCalcY(x0, m, b);
            let y1 = eqnOfLineCalcY(x1, m, b);
            g.drawLine(xToScreenX(x0), yToScreenY(y0), xToScreenX(x1), yToScreenY(y1));
        } catch (e) {
            console.criticalln("Graph drawLineSegment error: " + e);
        } finally {
            g.end();
        }
    };
    
    /**
     * Draw straight lines between the points in the supplied array
     * @param {Number[]} curvePoints Index is x-coordinate, value is y-coordinate
     * @param {Number} firstCoord x coordinate at curvePoints[0]
     * @param {Number} color Hex color value
     * @param {Boolean} antiAlias If true draw an antialiased line
     */
    this.drawCurve = function(curvePoints, firstCoord, color, antiAlias){
        let g;
        try {
            g = new Graphics(bitmap_);
            g.clipRect = new Rect(xOrigin_, yOrigin_ - yAxisLength_, xOrigin_ + xAxisLength_, yOrigin_);
            g.transparentBackground = true;
            g.antialiasing = antiAlias;
            g.pen = new Pen(color);
            for (let x=1; x < curvePoints.length; x++){
                let x0 = x - 1;
                let x1 = x;
                let y0 = curvePoints[x0];
                let y1 = curvePoints[x1];
                x0 += firstCoord;
                x1 += firstCoord;
                g.drawLine(xToScreenX(x0), yToScreenY(y0), xToScreenX(x1), yToScreenY(y1));
            }
        } catch (e) {
            console.criticalln("Graph drawCurve error: " + e);
        } finally {
            g.end();
        }
    };
    
    /**
     * Draw a point on the graph. If the point is outside the graph's data range,
     * an error is reported on the Console.
     * @param {Number} xWorld
     * @param {Number} yWorld
     * @param {Number} color
     */
    this.drawPoint = function(xWorld, yWorld, color){
        let x = xToScreenX(xWorld);
        let y = yToScreenY(yWorld);
        if (x >= xOrigin_ && y >= 0 && x < bitmap_.width && y <= yOrigin_){
            bitmap_.setPixel(x, y, color);
        }
    };
    
    /**
     * @returns {Bitmap} The bitmap the graph has been drawn on
     */
    this.getGraphBitmap = function(){
        return bitmap_;
    };
    
    /**
     * Create a PixInsight View window that contains the graph, but don't display it yet.
     * @param {String} title
     * @param {Boolean} isColor
     * @returns {ImageWindow|Graph.createWindow.imageWindow}
     */
    this.createWindow = function (title, isColor) {
        let bitsPerSample = 8;
        let nChannels = isColor ? 3 : 1;
        let imageWindow = new ImageWindow(bitmap_.width, bitmap_.height,
                nChannels, bitsPerSample, false, isColor, title);

        let view = imageWindow.mainView;
        let image = view.image;

        view.beginProcess(UndoFlag_NoSwapFile);
        image.blend(bitmap_);
        view.endProcess();

        return imageWindow;
    };
    
    /**
     * Calculate axis scale
     * @param {Number} axisLength
     * @param {Number} range
     * @returns {Number}
     */
    function calculateScale(axisLength, range){
        return (axisLength - 2) / range;
    }
    
    /**
     * Calculate axis length
     * @param {Number} scale
     * @param {Number} range
     * @returns {Number}
     */
    function calculateAxisLength(scale, range){
        return scale * range + 2;
    }
    
    /**
     * @param {Number} x X data value
     * @returns {Number} Screen X-Coordinate
     */
    function xToScreenX(x){
        return Math.round(xOrigin_ + (x - xMin_) * xScale_);
    }
    
    /**
     * @param {Number} y Y data value
     * @returns {Number} Screen Y-Coordinate
     */
    function yToScreenY(y){
        return Math.round(yOrigin_ - (y - yMin_) * yScale_);
    }
    
    /**
     * @param {Graphics} g
     * @param {Number} tickLength
     * @param {Number} minDistBetweenTicks
     * @param {String} axisLabel
     * @param {Number} axisColor
     * @returns {undefined}
     */
    function drawXAxis(g, tickLength, minDistBetweenTicks, axisLabel, axisColor){
        const y1 = yOrigin_;
        const xTickInterval = calculateTickIncrement(xMax_ - xMin_, xAxisLength_ / minDistBetweenTicks);
        const firstTickX = calculateFirstTick(xMin_, xTickInterval);
        
        const yAxisEnd = yOrigin_ - yAxisLength_;
        g.pen = new Pen(0xFF222222);
        for (let x = firstTickX; x <= xMax_; x += xTickInterval){
            let x1 = xToScreenX(x);
            if (x1 > xOrigin_){
                g.drawLine(x1, y1 - 1, x1, yAxisEnd);
            }
        }
        
        g.pen = new Pen(axisColor);
        g.drawLine(xOrigin_, yOrigin_, xOrigin_ + xAxisLength_, yOrigin_);
        let fontHeight = g.font.ascent + g.font.descent;
        for (let x = firstTickX; x <= xMax_; x += xTickInterval){
            let x1 = xToScreenX(x);
            g.drawLine(x1, y1, x1, y1 + tickLength);
            if (xTickInterval < 1){
                let n = Math.abs(x) > 1e-15 ? x : 0;
                let text = n.toExponential(2);
                let width = g.font.width(text);
                g.drawText(x1 - width/2, y1 + tickLength + fontHeight + 2, text);
            } else {
                let text = "" + x;
                let width = g.font.width(text);
                g.drawText(x1 - width/2, y1 + tickLength + fontHeight + 2, text);
            }
        }

        // Draw X-axis label
        let x = (xOrigin_ + xAxisLength_)/2 - g.font.width(axisLabel)/2;
        let y = y1 + tickLength + fontHeight * 2 + 4;
        g.drawText(x, y, axisLabel);
    }
    
    /**
     * @param {Graphics} g
     * @param {Number} tickLength
     * @param {Number} minDistBetweenTicks
     * @param {Number} axisColor
     * @returns {undefined}
     */
    function drawYAxis(g, tickLength, minDistBetweenTicks, axisColor){
        const x1 = xOrigin_;
        const yTickInterval = calculateTickIncrement(yMax_ - yMin_, yAxisLength_ / minDistBetweenTicks);
        const firstTickY = calculateFirstTick(yMin_, yTickInterval);
        
        const xAxisEnd = xOrigin_ + xAxisLength_;
        g.pen = new Pen(0xFF222222);
        for (let y = firstTickY; y <= yMax_; y += yTickInterval){
            let y1 = yToScreenY(y);
            if (y1 < yOrigin_){
                g.drawLine(x1 + 1, y1, xAxisEnd, y1);
            }
        }
        
        g.pen = new Pen(axisColor);
        g.drawLine(xOrigin_, yOrigin_, xOrigin_, yOrigin_ - yAxisLength_);
        for (let y = firstTickY; y <= yMax_; y += yTickInterval){
            let y1 = yToScreenY(y);
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
    }
    
    /**
     * @param {Font} font
     * @param {String} text
     * @param {Number} axisColor
     * @returns {undefined}
     */
    function drawYAxisLabel(font, text, axisColor){
        // draw into a small bitmap
        // rotate the bitmap by 90 degrees
        // copy bitmap into graph right hand margin
        let w = Math.min(yOrigin_, font.width(text));
        let h = font.ascent + font.descent;
        let textBitmap = new Bitmap(w, h);
        textBitmap.fill(0xFF000000);    // AARRGGBB
        let graphics;
        try {
            graphics = new Graphics(textBitmap);
            graphics.clipRect = new Rect(0, 0, w, h);
            graphics.transparentBackground = true;
            graphics.textAntialiasing = true;
            graphics.pen = new Pen(axisColor);
            graphics.drawText(0, h - font.descent, text);
        } catch (e) {
            console.criticalln("Graph drawYAxisLabel error: " + e);
        } finally {
            graphics.end();
        }
        
        try {
            let rotatedBitmap = textBitmap.rotated(-Math.PI/2);
            let y = Math.max(0, yOrigin_/2 - w/2);
            bitmap_.copy(new Point(0, y), rotatedBitmap);
        } catch (e){
            console.criticalln("Graph rotate bitmap error: " + e);
        }
    }
    
    /**
     * @param {Number} range xMax_ - xMin_
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
     * @param {type} minValue xMin
     * @param {type} tickIncrement
     * @returns {Number}
     */
    function calculateFirstTick(minValue, tickIncrement){
        return tickIncrement * Math.ceil(minValue / tickIncrement);
    }
}
