/* global UndoFlag_NoSwapFile */

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
    
    // private class data
    let xMin = x0;
    let yMin = y0;
    let xMax = x1;
    let yMax = y1;
    
    let bitmap;
    let xOrigin;
    let yOrigin;
    
    let xAxisLength;
    let yAxisLength;
    
    let xScale;
    let yScale;
    // End of private class data
    
    /**
     * Sets the x & y axis lengths and calculates the scales for both axis
     * @param {Number} xLength x-Axis length
     * @param {Number} yLength y-Axis length
     * @returns {undefined}
     */
    this.setAxisLength = function(xLength, yLength){
        xAxisLength = xLength;
        yAxisLength = yLength;
        xScale = calculateScale(xAxisLength, xMax - xMin);
        yScale = calculateScale(yAxisLength, yMax - yMin);
    };
    
    /**
     * Sets the x axis length and calculates the scale for the x axis
     * The y axis is set to the same scale and the y axis length is calculated
     * @param {Number} xLength x-Axis length
     * @returns {undefined}
     */
    this.setXAxisLength = function(xLength){
        xAxisLength = xLength;
        xScale = calculateScale(xAxisLength, xMax - xMin);
        yScale = xScale;
        yAxisLength = calculateAxisLength(yScale, yMax - yMin);
    };
    
    /**
     * Sets the y axis length and calculates the scale for the y axis
     * The x axis is set to the same scale and the x axis length is calculated
     * @param {Number} yLength y-Axis length
     * @returns {undefined}
     */
    this.setYAxisLength = function(yLength){
        yAxisLength = yLength;
        yScale = calculateScale(yAxisLength, yMax - yMin);
        xScale = yScale;
        xAxisLength = calculateAxisLength(xScale, xMax - xMin);
    };
    
    /**
     * Converts screen (x,y) into graph coordinates.
     * @param {Number} x Screen x coordinate
     * @param {Number} y Screen y coordinate
     * @returns {String} Output string in format "( x, y )"
     */
    this.screenToWorld = function( x, y ){
        let wx = (x - xOrigin) / xScale + xMin;
        let wy = (yOrigin - y) / yScale + yMin;
        let xText = wx < 1000 ? wx.toPrecision(3) : wx.toPrecision(4);
        let yText = wy < 1000 ? wy.toPrecision(3) : wy.toPrecision(4);
        return "( " + xText + ", " + yText + " )";
    };
    
    /**
     * Create the graph with fully drawn X-axis and Y-axis.
     * At this stage the graph contains no data.
     * @param {String} xLabel Text to display beneath the X-axis
     * @param {String} yLabel Text to rotate and display on the Y-axis
     */
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
        
        xOrigin = leftMargin;
        yOrigin = topMargin + yAxisLength - 1;
       
        let imageWidth = leftMargin + xAxisLength + rightMargin;
        let imageHeight = topMargin + yAxisLength + bottomMargin;
        bitmap = new Bitmap(imageWidth, imageHeight);
        bitmap.fill(0xFF000000);    // AARRGGBB
        
        let graphics = new Graphics(bitmap);
        graphics.transparentBackground = true;
        graphics.textAntialiasing = true;
        graphics.clipRect = new Rect(0, 0, imageWidth, imageHeight);
        drawXAxis(graphics, tickLength, minDistBetweenTicks, this.axisColor);
        drawYAxis(graphics, tickLength, minDistBetweenTicks, this.axisColor);
        drawXAxisLabel(graphics, imageWidth, imageHeight, xLabel, this.axisColor);
        graphics.end();
        drawYAxisLabel(font, imageHeight, yLabel, this.axisColor);
    };
    
    /**
     * Create a graph with no axis or margins. It only contains the data area.
     * This is used to create seperate red, green and blue graphs that can be
     * bitwise ORed together to blend the colors
     * @returns {Graph}
     */
    this.createGraphAreaOnly = function () {
        let newGraph = new Graph(xMin, yMin, xMax, yMax);
        newGraph.setToGraphAreaOnlyMode(xAxisLength, yAxisLength, xScale, yScale);
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
        xAxisLength = xLength;
        yAxisLength = yLength;
        xScale = scaleX;
        yScale = scaleY;
        xOrigin = 0;
        yOrigin = yAxisLength - 1;
        bitmap = new Bitmap(xAxisLength, yAxisLength);
        bitmap.fill(0x00000000);    // AARRGGBB
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
        let p = new Point(xOrigin, yOrigin - yAxisLength);
        bitmap.or(p, graphAreaOnly.getGraphBitmap());
    };
    
    /** Draw a line that traverses the whole data area
     * @param {Number} m gradient
     * @param {Number} b Y-Axis intercept
     * @param {type} color Line color (0xAARRGGBB)
     */
    this.drawLine = function(m, b, color){
        this.drawLineSegment(m, b, color, false, xMin, xMax);
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
        let g = new Graphics(bitmap);
        g.clipRect = new Rect(xOrigin, yOrigin - yAxisLength, xOrigin + xAxisLength, yOrigin);
        g.transparentBackground = true;
        g.antialiasing = antiAlias;
        g.pen = new Pen(color);
        let y0 = eqnOfLineCalcY(x0, m, b);
        let y1 = eqnOfLineCalcY(x1, m, b);
        g.drawLine(xToScreenX(x0), yToScreenY(y0), xToScreenX(x1), yToScreenY(y1));
        g.end();
    };
    
    /**
     * Draw straigth lines between the points in the supplied array
     * @param {Number[]} difArray Index is x-coordinate, value is y-coordinate
     * @param {Number} firstCoord x or y coordinate for first difArray entry
     * @param {Number} color Hex color value
     * @param {Boolean} antiAlias If true draw an antialiased line
     */
    this.drawDifArray = function(difArray, firstCoord, color, antiAlias){
        let g = new Graphics(bitmap);
        g.clipRect = new Rect(xOrigin, yOrigin - yAxisLength, xOrigin + xAxisLength, yOrigin);
        g.transparentBackground = true;
        g.antialiasing = antiAlias;
        g.pen = new Pen(color);
        for (let x=1; x < difArray.length; x++){
            let x0 = x - 1;
            let x1 = x;
            let y0 = difArray[x0];
            let y1 = difArray[x1];
            x0 += firstCoord;
            x1 += firstCoord;
            g.drawLine(xToScreenX(x0), yToScreenY(y0), xToScreenX(x1), yToScreenY(y1));
        }
        g.end();
    };
    
    /**
     * Draw a point on the graph. If the point is outside the graph's data range,
     * a error is reported on the Console.
     * @param {Number} xWorld
     * @param {Number} yWorld
     * @param {Number} color
     */
    this.drawPoint = function(xWorld, yWorld, color){
        let x = xToScreenX(xWorld);
        let y = yToScreenY(yWorld);
        if (x >= 0 && y >= 0 && x < bitmap.width && y < bitmap.height){
            bitmap.setPixel(x, y, color);
        } else {
            console.criticalln("Out of range: (" + x + "," + y + ") bitmap width: "
                    + bitmap.width + " heigth: " + bitmap.height);
        }
    };
    
    /**
     * @returns {Bitmap} The bitmap the graph has been drawn on
     */
    this.getGraphBitmap = function(){
        return bitmap;
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
        let imageWindow = new ImageWindow(bitmap.width, bitmap.height,
                nChannels, bitsPerSample, false, isColor, title);

        let view = imageWindow.mainView;
        let image = view.image;

        view.beginProcess(UndoFlag_NoSwapFile);
        image.blend(bitmap);
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
        return Math.round(xOrigin + (x - xMin) * xScale);
    }
    
    /**
     * @param {Number} y Y data value
     * @returns {Number} Screen Y-Coordinate
     */
    function yToScreenY(y){
        return Math.round(yOrigin - (y - yMin) * yScale);
    }
    
    /**
     * @param {Graphics} g
     * @param {Number} tickLength
     * @param {Number} minDistBetweenTicks
     * @param {Number} axisColor
     * @returns {undefined}
     */
    function drawXAxis(g, tickLength, minDistBetweenTicks, axisColor){
        const y1 = yOrigin;
        const xTickInterval = calculateTickIncrement(xMax - xMin, xAxisLength / minDistBetweenTicks);
        const firstTickX = calculateFirstTick(xMin, xTickInterval);
        
        const yAxisEnd = yOrigin - yAxisLength;
        g.pen = new Pen(0xFF222222);
        for (let x = firstTickX; x <= xMax; x += xTickInterval){
            let x1 = xToScreenX(x);
            if (x1 > xOrigin){
                g.drawLine(x1, y1 - 1, x1, yAxisEnd);
            }
        }
        
        g.pen = new Pen(axisColor);
        g.drawLine(xOrigin, yOrigin, xOrigin + xAxisLength, yOrigin);
        let fontHeight = g.font.ascent + g.font.descent;
        for (let x = firstTickX; x <= xMax; x += xTickInterval){
            let x1 = xToScreenX(x);
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
    }
    
    /**
     * @param {Graphics} g
     * @param {Number} tickLength
     * @param {Number} minDistBetweenTicks
     * @param {Number} axisColor
     * @returns {undefined}
     */
    function drawYAxis(g, tickLength, minDistBetweenTicks, axisColor){
        const x1 = xOrigin;
        const yTickInterval = calculateTickIncrement(yMax - yMin, yAxisLength / minDistBetweenTicks);
        const firstTickY = calculateFirstTick(yMin, yTickInterval);
        
        const xAxisEnd = xOrigin + xAxisLength;
        g.pen = new Pen(0xFF222222);
        for (let y = firstTickY; y <= yMax; y += yTickInterval){
            let y1 = yToScreenY(y);
            if (y1 < yOrigin){
                g.drawLine(x1 + 1, y1, xAxisEnd, y1);
            }
        }
        
        g.pen = new Pen(axisColor);
        g.drawLine(xOrigin, yOrigin, xOrigin, yOrigin - yAxisLength);
        for (let y = firstTickY; y <= yMax; y += yTickInterval){
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
     * @param {Graphics} g
     * @param {Number} imageWidth
     * @param {Number} imageHeight
     * @param {String} text
     * @param {Number} axisColor
     * @returns {undefined}
     */
    function drawXAxisLabel(g, imageWidth, imageHeight, text, axisColor){
        let x = imageWidth/2 - g.font.width(text)/2;
        let y = imageHeight - 5;
        g.pen = new Pen(axisColor);
        g.drawText(x, y, text);
    }
    
    /**
     * @param {Font} font
     * @param {Number} imageHeight
     * @param {String} text
     * @param {Number} axisColor
     * @returns {undefined}
     */
    function drawYAxisLabel(font, imageHeight, text, axisColor){
        // draw into a small bitmap
        // rotate the bit map by 90 degrees
        // copy bitmap into graph right hand margin
        let w = Math.min(imageHeight, font.width(text));
        let h = font.ascent + font.descent;
        let textBitmap = new Bitmap(w, h);
        textBitmap.fill(0xFF000000);    // AARRGGBB
        let graphics = new Graphics(textBitmap);
        graphics.clipRect = new Rect(0, 0, w, h);
        graphics.transparentBackground = true;
        graphics.textAntialiasing = true;
        graphics.pen = new Pen(axisColor);
        graphics.drawText(0, h - font.descent, text);
        graphics.end();
        let rotatedBitmap = textBitmap.rotated(-Math.PI/2);
        let y = Math.max(0, imageHeight/2 - w/2);
        bitmap.copy(new Point(0, y), rotatedBitmap);
    }
    
    /**
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
     * @param {type} minValue xMin
     * @param {type} tickIncrement
     * @returns {Number}
     */
    function calculateFirstTick(minValue, tickIncrement){
        return tickIncrement * Math.ceil(minValue / tickIncrement);
    }
}
