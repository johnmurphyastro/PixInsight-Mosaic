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
    
    let dataSamplePairs_;    // Sample Pairs that are closest to the graphLinePath
    let graphLinePath_;      // Display the gradient along this line
    
    function construct(){
        let title = "Gradient Graph";
        if (isExtrapolateGraph){
            // This path is along the side of the overlap bounding box
            graphLinePath_ = createExtrapolateGradientPath(tgtImage, data.cache.overlap, joinRect, isHorizontal, isTargetAfterRef, data);
            title += " (Target image)";
        } else {
            // This path is along the center of the joinRect, but constrained by the overlap area
            graphLinePath_ = createOverlapGradientPath(tgtImage, data.cache.overlap, joinRect, isHorizontal, isTargetAfterRef, data);
            title += " (Overlap region)";
        }
        // Get a the SamplePairs that are closest to the line path
        dataSamplePairs_ = getDataSamplePairs(graphLinePath_, colorSamplePairs, data.sampleSize, isHorizontal);
        
        // Display graph in script dialog
        let graphDialog = new GradientGraphDialog(title, data.graphWidth, data.graphHeight, createZoomedGraph);
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
        let graph = createGraph(width, height, isHorizontal, surfaceSplines, graphLinePath_,
                joinRect, dataSamplePairs_, data, factor);
        return graph;
    }
    
    /**
     * @param {Number} width
     * @param {Number} height
     * @param {Boolean} isHorizontal
     * @param {SurfaceSpline[]} surfaceSplines Difference between reference and target images
     * @param {Point[]} graphLinePath 
     * @param {Rect} joinRect Join region or overlap bounding box 
     * @param {SamplePair[][]} dataSamplePairs The SamplePair points to be displayed for each channel
     * @param {PhotometricMosaicData} data User settings used to create FITS header
     * @param {Graph function(float zoomFactor)} zoomFactor Zoom factor for vertical axis only zooming.
     * @returns {Graph}
     */
    function createGraph(width, height, isHorizontal, surfaceSplines, graphLinePath,
                joinRect, dataSamplePairs, data, zoomFactor){
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
        let yCoordinateRange = new SamplePairDifMinMax(dataSamplePairs, minScaleDif, zoomFactor);
        
        return createAndDrawGraph(xLabel, yLabel, yCoordinateRange, width, height, isHorizontal, 
                surfaceSplines, graphLinePath, joinRect, dataSamplePairs);
    }
    
    /**
     * Returns the SamplePairs that are closest to the graphLinePath
     * @param {Point[]} graphLinePath
     * @param {SamplePair[][]} colorSamplePairs
     * @param {Number} sampleSize 
     * @param {Boolean} isHorizontal
     * @returns {SamplePair[][]}
     */
    function getDataSamplePairs(graphLinePath, colorSamplePairs, sampleSize, isHorizontal){
        /**
         * @param {SamplePair} samplePair
         * @param {Point[]} path 
         * @param {Boolean} isHorizontal
         * @returns {GradientGraph.getDataSamplePairs.MapEntry} contains {samplePair, dif, pathIdx}
         */
        function MapEntry (samplePair, path, isHorizontal){
            this.samplePair = samplePair;
            this.dist = Number.POSITIVE_INFINITY;
            this.pathIdx = -1;
            if (isHorizontal){
                let minCoord = path[0].x;
                this.pathIdx = Math.round(samplePair.rect.center.x) - minCoord;
                if (this.pathIdx >= 0 && this.pathIdx < path.length){
                    this.dist = Math.abs(samplePair.rect.center.y - path[this.pathIdx].y);
                } else {
                    console.criticalln("getDataSamplePairs: Out of range!");
                }
            } else {
                let minCoord = path[0].y;
                this.pathIdx = Math.round(samplePair.rect.center.y) - minCoord;
                if (this.pathIdx >= 0 && this.pathIdx < path.length){
                    this.dist = Math.abs(samplePair.rect.center.x - path[this.pathIdx].x);
                } else {
                    console.criticalln("getDataSamplePairs: Out of range!");
                }
            }
        }
        
        let dataSamplePairs = [];
        let nChannels = colorSamplePairs.length;
        let maxDist = sampleSize * 2;
        for (let c=0; c<nChannels; c++){
            dataSamplePairs[c] = [];
            let pathMap = new Map();
            for (let i=0; i<colorSamplePairs[c].length; i++){
                let samplePairs = colorSamplePairs[c];
                let value = new MapEntry(samplePairs[i], graphLinePath, isHorizontal);
                if (value.dist < maxDist){
                    let key = value.pathIdx;
                    if (pathMap.has(key)){
                        let mapValue = pathMap.get(key);
                        if (value.dist < mapValue.dist){
                            // closer to path
                            pathMap.set(key, value);
                        }
                    } else {
                        pathMap.set(key, value);
                    }
                }
            }
            
            // Get values from map and convert to an array.
            for (let mapValue of pathMap.values()){
                dataSamplePairs[c].push(mapValue.samplePair);
            }
        }
        
        return dataSamplePairs;
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
     * @param {Number[]} difArray Points to plot. Offset difference between ref and tgt
     * @param {Number} difArrayOffset
     * @param {Number} lineColor
     * @param {SamplePair[]} samplePairs
     * @param {Number} pointColor
     * @returns {undefined}
     */
    function drawLineAndPoints(graph, isHorizontal,
            difArray, difArrayOffset, lineColor, samplePairs, pointColor) {
                
        for (let samplePair of samplePairs) {
            // Draw the sample points
            let coord = isHorizontal ? samplePair.rect.center.x : samplePair.rect.center.y;
            graph.drawCross(coord, samplePair.getDifference(), pointColor);
        }
        graph.drawCurve(difArray, difArrayOffset, lineColor, true);
    }
    
    /**
     * 
     * @param {String} xLabel
     * @param {String} yLabel
     * @param {SamplePairDifMinMax} yCoordinateRange 
     * @param {Number} width 
     * @param {Number} height 
     * @param {Boolean} isHorizontal
     * @param {SurfaceSpline[]} surfaceSplines
     * @param {Point[]} graphLinePath
     * @param {Rect} joinRect
     * @param {SamplePair[][]} dataSamplePairs
     * @returns {Graph}
     */
    function createAndDrawGraph(xLabel, yLabel, yCoordinateRange, width, height, 
            isHorizontal, surfaceSplines, graphLinePath, joinRect, dataSamplePairs){
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
        let difArrayOffset = isHorizontal ? graphLinePath[0].x : graphLinePath[0].y;
        
        if (dataSamplePairs.length === 1){ // B&W
            let difArray = surfaceSplines[0].evaluate(graphLinePath).toArray();
            drawLineAndPoints(graph, isHorizontal,
                difArray, difArrayOffset, 0xFF990000, dataSamplePairs[0], 0xFFFFFFFF);
        } else {
            // Color. Need to create 3 graphs for r, g, b and then merge them (binary OR) so that
            // if three samples are on the same pixel we get white and not the last color drawn
//            let lineBoldColors = [0xFFFF0000, 0xFF00FF00, 0xFF0000FF]; // r, g, b
            let lineColors = [0xFF990000, 0xFF009900, 0xFF000099]; // r, g, b
            let pointColors = [0xFFCC0000, 0xFF00CC00, 0xFF0000CC]; // r, g, b
            for (let c = 0; c < dataSamplePairs.length; c++){
                let difArray = surfaceSplines[c].evaluate(graphLinePath).toArray();
                let graphAreaOnly = graph.createGraphAreaOnly();
                drawLineAndPoints(graphAreaOnly, isHorizontal,
                    difArray, difArrayOffset, lineColors[c], dataSamplePairs[c], pointColors[c]);
                graph.mergeWithGraphAreaOnly(graphAreaOnly);
            }
        }
        return graph;
    }
    
    construct();
}

/**
 * @param {Image} tgtImage 
 * @param {Overlap} overlap
 * @param {Rect} joinRect
 * @param {Boolean} isHorizontal
 * @param {Boolean} isTargetAfterRef
 * @param {PhotometricMosaicData} data
 * @returns {Point[]}
 */
function createOverlapGradientPath(tgtImage, overlap, joinRect, isHorizontal, isTargetAfterRef, data){
    let regions = new TargetRegions(tgtImage.width, tgtImage.height, 
            overlap, joinRect, isHorizontal, data, isTargetAfterRef);
    let joinMidPath;
    if (isHorizontal){
        joinMidPath = overlap.calcHorizOutlinePath(regions.joinMiddle);
    } else {
        joinMidPath = overlap.calcVerticalOutlinePath(regions.joinMiddle);
    }
    
    // draw join path bold
    return joinMidPath;   
}
    
/**
 * Creates a straight line path that follows the target side of the overlap bounding box.
 * @param {Image} tgtImage
 * @param {Overlap} overlap
 * @param {Rect} joinRect
 * @param {Boolean} isHorizontal
 * @param {Boolean} isTargetAfterRef
 * @param {PhotometricMosaicData} data
 * @returns {Point[]}
 */
function createExtrapolateGradientPath(tgtImage, overlap, joinRect, isHorizontal, isTargetAfterRef, data){
    let regions = new TargetRegions(tgtImage.width, tgtImage.height, 
            overlap, joinRect, isHorizontal, data, isTargetAfterRef);
    let overlapBox = overlap.overlapBox;

    let graphLinePath;
    // Extrapolated gradient region is target side of overlap
    if (isHorizontal){
        if (isTargetAfterRef){
            let overlapEndPath = createHorizontalPath(regions.overlapEnd, overlapBox);
            graphLinePath = overlapEndPath;
        } else {
            let overlapStartPath = createHorizontalPath(regions.overlapStart, overlapBox);
            graphLinePath = overlapStartPath;
        }
    } else {
        if (isTargetAfterRef){
            let overlapEndPath = createVerticalPath(regions.overlapEnd, overlapBox);
            graphLinePath = overlapEndPath;
        } else {
            let overlapStartPath = createVerticalPath(regions.overlapStart, overlapBox);
            graphLinePath = overlapStartPath;
        }        
    }

    return graphLinePath;
}

