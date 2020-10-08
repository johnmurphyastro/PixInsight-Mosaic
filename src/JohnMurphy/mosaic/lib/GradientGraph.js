/* global StdButton_Yes, UndoFlag_NoSwapFile */

// Version 1.0 (c) John Murphy 8th-Oct-2020
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
 * Calculates maximum and minimum values for the sample points
 * @param {SamplePair[][]} colorSamplePairs SamplePair[] for each channel
 * @param {Number} minScaleDif Range will be at least +/- this value from the average value
 * @param {Number} zoomFactor Zoom in by modifying minDif and maxDif (smaller
 * range produces a more zoomed in view)
 * @returns {SamplePairDifMinMax}
 */
function SamplePairDifMinMax(colorSamplePairs, minScaleDif, zoomFactor) {
    this.minDif = Number.POSITIVE_INFINITY;
    this.maxDif = Number.NEGATIVE_INFINITY;
    this.avgDif = 0;
    let total = 0;
    for (let c=0; c<colorSamplePairs.length; c++) {
        let samplePairs = colorSamplePairs[c];
        total += samplePairs.length;
        for (let samplePair of samplePairs) {
            let dif = samplePair.getDifference();
            this.minDif = Math.min(this.minDif, dif);
            this.maxDif = Math.max(this.maxDif, dif);
            this.avgDif += dif;
        }
    }
    this.avgDif /= total;
    if (this.maxDif - this.minDif < minScaleDif){
        this.maxDif = Math.max(this.maxDif, this.avgDif + minScaleDif);
        this.minDif = Math.min(this.minDif, this.avgDif - minScaleDif);
    }
    if (zoomFactor !== 1){
        let totalDif = (this.maxDif - this.minDif) / zoomFactor;
        this.maxDif = this.avgDif + totalDif / 2;
        this.minDif = this.avgDif - totalDif / 2;
    }
}

/**
 * Display graph of (difference between images) / (pixel distance across image)
 * @param {Image} tgtImage 
 * @param {Boolean} isHorizontal
 * @param {Boolean} isTargetAfterRef true if target is below reference or target is right of reference 
 * @param {SurfaceSpline[]} surfaceSplines Difference between reference and target images
 * @param {Rect} joinRect Create dif arrays at either side of this rectangle 
 * @param {SamplePair[][]} colorSamplePairs The SamplePair points to be displayed for each channel
 * @param {PhotometricMosaicData} data User settings used to create FITS header
 * @param {Boolean} isExtrapolateGraph If true, display single line for target side of overlap bounding box
 * @returns {undefined}
 */
function GradientGraph(tgtImage, isHorizontal, isTargetAfterRef, surfaceSplines, 
        joinRect, colorSamplePairs, data, isExtrapolateGraph){
    
    function construct(){
        // Display graph in script dialog
        let graphDialog = new GradientGraphDialog("Gradient Graph", data.graphWidth, data.graphHeight, createZoomedGraph);
        if (graphDialog.execute() === StdButton_Yes){
            // User requested graph saved to PixInsight View
            let windowTitle = WINDOW_ID_PREFIX() + data.targetView.fullId + "__Gradient";
            let zoomedGraph = graphDialog.getGraph();
            let imageWindow = zoomedGraph.createWindow(windowTitle, true);
            gradientGraphFitsHeader(imageWindow, data, isHorizontal, isTargetAfterRef);
            imageWindow.show();
        }
    }
    
    /**
     * Callback function for GraphDialog to provide a zoomed graph.
     * GraphDialog uses Graph.getGraphBitmap() and the function pointer Graph.screenToWorld
     * @param {Number} factor
     * @param {Number} width
     * @param {Number} height
     * @returns {Graph}
     */
    function createZoomedGraph(factor, width, height){
        // Using GradientGraph function call parameters
        let graph = createGraph(tgtImage, width, height, isHorizontal, isTargetAfterRef, surfaceSplines, 
                joinRect, colorSamplePairs, data, isExtrapolateGraph, factor);
        return graph;
    }
    
    /**
     * @param {Image} tgtImage 
     * @param {Number} width
     * @param {Number} height
     * @param {Boolean} isHorizontal
     * @param {Boolean} isTargetAfterRef true if target is below reference or target is right of reference 
     * @param {SurfaceSpline[]} surfaceSplines Difference between reference and target images
     * @param {Rect} joinRect Join region or overlap bounding box 
     * @param {SamplePair[][]} colorSamplePairs The SamplePair points to be displayed for each channel
     * @param {PhotometricMosaicData} data User settings used to create FITS header
     * @param {Boolean} isExtrapolateGraph
     * @param {Graph function(float zoomFactor)} zoomFactor Zoom factor for vertical axis only zooming.
     * @returns {Graph}
     */
    function createGraph(tgtImage, width, height, isHorizontal, isTargetAfterRef, surfaceSplines, 
                joinRect, colorSamplePairs, data, isExtrapolateGraph, zoomFactor){
        let xLabel;
        if (isHorizontal){
            xLabel = "Mosaic tile join X-coordinate";
        } else {
            xLabel = "Mosaic tile join Y-coordinate";
        }
        let yLabel = "(" + data.targetView.fullId + ") - (" + data.referenceView.fullId + ")";
        // Graph scale
        // gradientArray stores min / max of fitted lines.
        // also need min / max of sample points.
        const minScaleDif = 5e-5;
        let yCoordinateRange = new SamplePairDifMinMax(colorSamplePairs, minScaleDif, zoomFactor);
        
        return createAndDrawGraph(xLabel, yLabel, yCoordinateRange,
                tgtImage, width, height, isHorizontal, isTargetAfterRef, surfaceSplines, 
                joinRect, colorSamplePairs, data, isExtrapolateGraph);
    }
    
    /**
     * 
     * @param {ImageWindow} graphWindow Graph window
     * @param {PhotometricMosaicData} data User settings used to create FITS header
     * @param {Boolean} isHorizontal
     * @param {Boolean} isTargetAfterRef
     */
    function gradientGraphFitsHeader(graphWindow, data, isHorizontal, isTargetAfterRef){
        let view = graphWindow.mainView;
        view.beginProcess(UndoFlag_NoSwapFile); // don't add to undo list
        let keywords = graphWindow.keywords;
        fitsHeaderImages(keywords, data);
        fitsHeaderStarDetection(keywords, data);
        fitsHeaderPhotometry(keywords, data);
        let includeGradient = (data.viewFlag === DISPLAY_OVERLAP_GRADIENT_GRAPH());
        let includePropagate = (data.viewFlag === DISPLAY_EXTRAPOLATED_GRADIENT_GRAPH());
        fitsHeaderGradient(keywords, data, includeGradient, includePropagate);
        fitsHeaderOrientation(keywords, isHorizontal, isTargetAfterRef);
        fitsHeaderMosaic(keywords, data);
        graphWindow.keywords = keywords;
        view.endProcess();
    }
    
    /**
     * Draw gradient line and sample points for a single color channel.
     * @param {Graph} graph
     * @param {Boolean} isHorizontal
     * @param {Number[][]} difArrays Array of DifArray to draw
     * @param {Number} lineBoldColor
     * @param {GraphLinePath[]} graphLinePaths
     * @param {Number} lineColor
     * @param {SamplePair[]} samplePairs
     * @param {Number} pointColor
     * @returns {undefined}
     */
    function drawLineAndPoints(graph, isHorizontal,
            difArrays, lineBoldColor, graphLinePaths, lineColor, samplePairs, pointColor) {
                
        for (let samplePair of samplePairs) {
            // Draw the sample points
            let coord = isHorizontal ? samplePair.rect.center.x : samplePair.rect.center.y;
            graph.drawPoint(coord, samplePair.getDifference(), pointColor);
        }
        for (let i = 0; i < difArrays.length; i++){
            let difArray = difArrays[i];
            let graphLinePath = graphLinePaths[i];
            let path = graphLinePath.path;
            let firstCoord = isHorizontal ? path[0].x : path[0].y;
            if (graphLinePath.bold){
                graph.drawCurve(difArray, firstCoord, lineBoldColor, true);
            } else {
                graph.drawCurve(difArray, firstCoord, lineColor, false);
            }
        }
    }
    
    /**
     * 
     * @param {String} xLabel
     * @param {String} yLabel
     * @param {SamplePairDifMinMax} yCoordinateRange
     * @param {Image} tgtImage 
     * @param {Number} width 
     * @param {Number} height 
     * @param {Boolean} isHorizontal
     * @param {Boolean} isTargetAfterRef
     * @param {SurfaceSpline[]} surfaceSplines
     * @param {Rect} joinRect
     * @param {SamplePair[][]} colorSamplePairs
     * @param {PhotometricMosaicData} data
     * @param {Boolean} isExtrapolateGraph
     * @returns {Graph}
     */
    function createAndDrawGraph(xLabel, yLabel, yCoordinateRange,
            tgtImage, width, height, isHorizontal, isTargetAfterRef, surfaceSplines, joinRect, colorSamplePairs,
            data, isExtrapolateGraph){
        let maxY = yCoordinateRange.maxDif;
        let minY = yCoordinateRange.minDif;
        let minX;
        let maxX;
        if (isHorizontal){
            minX = joinRect.x0;
            maxX = joinRect.x1;
        } else {
            minX = joinRect.y0;
            maxX = joinRect.y1;
        }
        let graph = new Graph(minX, minY, maxX, maxY);
        graph.createGraph(xLabel, yLabel, width, height, false);

        let graphLines;
        if (isExtrapolateGraph){
            graphLines = createExtrapolateGradientPaths(tgtImage, data.cache.overlap, joinRect, isHorizontal, isTargetAfterRef, data);
        } else {
            graphLines = createOverlapGradientPaths(tgtImage, data.cache.overlap, joinRect, isHorizontal, isTargetAfterRef, data);
        }

        if (colorSamplePairs.length === 1){ // B&W
            let difArrays = [];
            for (let graphLine of graphLines){
                difArrays.push(surfaceSplines[0].evaluate(graphLine.path).toArray());
            }
            drawLineAndPoints(graph, isHorizontal,
                difArrays, 0xFFFF0000, graphLines, 0xFF990000, colorSamplePairs[0], 0xFFFFFFFF);
        } else {
            // Color. Need to create 3 graphs for r, g, b and then merge them (binary OR) so that
            // if three samples are on the same pixel we get white and not the last color drawn
            let lineBoldColors = [0xFFFF0000, 0xFF00FF00, 0xFF0000FF]; // r, g, b
            let lineColors = [0xFF990000, 0xFF009900, 0xFF000099]; // r, g, b
            let pointColors = [0xFFCC0000, 0xFF00CC00, 0xFF0000CC]; // r, g, b
            for (let c = 0; c < colorSamplePairs.length; c++){
                let difArrays = [];
                for (let graphLine of graphLines){
                    difArrays.push(surfaceSplines[c].evaluate(graphLine.path).toArray());
                }
                let graphAreaOnly = graph.createGraphAreaOnly();
                drawLineAndPoints(graphAreaOnly, isHorizontal,
                    difArrays, lineBoldColors[c], graphLines, lineColors[c], colorSamplePairs[c], pointColors[c]);
                graph.mergeWithGraphAreaOnly(graphAreaOnly);
            }
        }
        return graph;
    }
    
    construct();
}

/**
 * Path across the overlap region
 * @param {Point[]} path
 * @param {Boolean} bold
 * @returns {GraphLinePath}
 */
function GraphLinePath(path, bold){
    this.path = path;
    this.bold = bold;
}

/**
 * @param {Image} tgtImage 
 * @param {Overlap} overlap
 * @param {Rect} joinRect
 * @param {Boolean} isHorizontal
 * @param {Boolean} isTargetAfterRef
 * @param {PhotometricMosaicData} data
 * @returns {GraphLinePath[]}
 */
function createOverlapGradientPaths(tgtImage, overlap, joinRect, isHorizontal, isTargetAfterRef, data){
    let regions = new TargetRegions(tgtImage.width, tgtImage.height, 
            overlap, joinRect, isHorizontal, data, isTargetAfterRef);
    let joinMidPath;
    if (isHorizontal){
        joinMidPath = overlap.calcHorizOutlinePath(regions.joinMiddle);
    } else {
        joinMidPath = overlap.calcVerticalOutlinePath(regions.joinMiddle);
    }
    
    let graphLinePaths = [];
    // draw join path bold
    graphLinePaths.push(new GraphLinePath(joinMidPath, true));   
    return graphLinePaths;
}
    
/**
 * Creates a straight line path that follows the target side of the overlap bounding box.
 * @param {Image} tgtImage
 * @param {Overlap} overlap
 * @param {Rect} joinRect
 * @param {Boolean} isHorizontal
 * @param {Boolean} isTargetAfterRef
 * @param {PhotometricMosaicData} data
 * @returns {GraphLinePath[]}
 */
function createExtrapolateGradientPaths(tgtImage, overlap, joinRect, isHorizontal, isTargetAfterRef, data){
    let regions = new TargetRegions(tgtImage.width, tgtImage.height, 
            overlap, joinRect, isHorizontal, data, isTargetAfterRef);
    let overlapBox = overlap.overlapBox;

    let graphLinePaths = [];
    // Extrapolated gradient region is target side of overlap
    if (isHorizontal){
        if (isTargetAfterRef){
            let overlapEndPath = createHorizontalPath(regions.overlapEnd, overlapBox);
            graphLinePaths.push(new GraphLinePath(overlapEndPath, false));
        } else {
            let overlapStartPath = createHorizontalPath(regions.overlapStart, overlapBox);
            graphLinePaths.push(new GraphLinePath(overlapStartPath, false));
        }
    } else {
        if (isTargetAfterRef){
            let overlapEndPath = createVerticalPath(regions.overlapEnd, overlapBox);
            graphLinePaths.push(new GraphLinePath(overlapEndPath, false));
        } else {
            let overlapStartPath = createVerticalPath(regions.overlapStart, overlapBox);
            graphLinePaths.push(new GraphLinePath(overlapStartPath, false));
        }        
    }

    return graphLinePaths;
}

