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
#define __PJSR_NO_STAR_DETECTOR_TEST_ROUTINES 1
#include "StarDetector.jsh"

/**
 * 
 * @param {type} refView
 * @param {type} tgtView
 * @param {type} previewArea
 * @param {type} logStarDetectionSensitivity
 * @param {type} upperLimit
 * @returns {StarPairs[]} Array of StarPairs for all color channels
 */
function calcScaleMult(refView, tgtView, previewArea, 
        logStarDetectionSensitivity, upperLimit){
    let colorStarPairs = [];
    let nChannels = refView.image.isColor ? 3 : 1;
    for (let i=0; i < nChannels; i++){
        let starPairs = getStarPairs(refView, tgtView, previewArea, 
                logStarDetectionSensitivity, upperLimit, i);
        colorStarPairs.push(starPairs);
    }
    return colorStarPairs;
}

/**
 * Finds the stars that exist in both images
 * If the supplied images are color, the specified channel is extracted from the 
 * reference and target images.
 * @param {View} refView Reference view.
 * @param {View} tgtView Target view.
 * @param {Rectange} previewArea Preview area or area of whole image
 * @param {Number} logStarDetectionSensitivity Smaller values detect more stars. -1, to 1 good values
 * @param {Number} upperLimit Ignore stars with a peak value greater than this.
 * @param {Number} channel Detect stars in this RGB channel. B&W = 0, R=0,G=1,B=2
 * @returns {StarPairs}
 */
function getStarPairs(refView, tgtView, previewArea, 
        logStarDetectionSensitivity, upperLimit, channel){
    let isColor = refView.image.isColor;
    let imgRefWindow = null;
    let imgTgtWindow = null;
    let starRefView;
    let starTgtView;
    if (isColor){
        // Extract the specified color channel from both target and reference images
        // ChannelExtraction creates a new B&W image for the extracted channel
        let P = new ChannelExtraction;
        P.colorSpace = ChannelExtraction.prototype.RGB;
        P.sampleFormat = ChannelExtraction.prototype.SameAsSource;
        P.channels = [// enabled, id
            [channel % 3 === 0, "REF_CHANNEL"],
            [channel % 3 === 1, "REF_CHANNEL"],
            [channel % 3 === 2, "REF_CHANNEL"]
        ];
        P.executeOn(refView);

        P.channels = [// enabled, id
            [channel % 3 === 0, "TGT_CHANNEL"],
            [channel % 3 === 1, "TGT_CHANNEL"],
            [channel % 3 === 2, "TGT_CHANNEL"]
        ];
        P.executeOn(tgtView);

        imgRefWindow = ImageWindow.windowById( "REF_CHANNEL" );
        imgTgtWindow = ImageWindow.windowById( "TGT_CHANNEL" );
        starRefView = imgRefWindow.mainView;
        starTgtView = imgTgtWindow.mainView;
    } else {
        // Input images are B&W so we can use them directly
        starRefView = refView;
        starTgtView = tgtView;
    }
        
    // Detect the stars within the image
    let starPairs = getStarPairsMonoImages(starRefView, starTgtView, previewArea,
            logStarDetectionSensitivity, upperLimit);

    if (isColor){
        // We must close the temporary windows we created
        imgRefWindow.forceClose();
        imgTgtWindow.forceClose();
    }
    
    return starPairs;
}

/** Private method
 * Finds the stars that exist in both images.
 * Images must be monochrome
 * If the supplied images are color, the luminance is used.
 * Call this method 3 times with R, G, B images to get data for individual channels
 * @param {View} refView Reference view.
 * @param {View} tgtView Target view.
 * @param {Rectange} previewArea Preview area or area of whole image
 * @param {Number} logStarDetectionSensitivity Smaller values detect more stars. -1, to 1 good values
 * @param {Number} upperLimit Ignore stars with a peak value greater than this.
 * @returns {StarPairs}
 */
function getStarPairsMonoImages(refView, tgtView, previewArea, logStarDetectionSensitivity, upperLimit){
            
    let refImage = refView.image;
    let tgtImage = tgtView.image;
    let mask = new Image(refImage.width, refImage.height, 1);
    mask.fill(0);
  
    let nChannels = refView.image.isColor ? 3 : 1;
  
    // Create a mask to restrict the star detection to the overlapping area and previewArea
    let xMin = previewArea.x;
    let xMax = previewArea.x + previewArea.width;
    let yMin = previewArea.y;
    let yMax = previewArea.y + previewArea.height;
    for (let x = xMin; x < xMax; x++){
        for (let y = yMin; y < yMax; y++){
            let value = 1;
            for (let c = nChannels-1; c >= 0; c--){
                if (tgtImage.sample(x, y, c) === 0 || refImage.sample(x, y, c) === 0){
                    value = 0;
                    break;
                }
            }
            mask.setSample(value, x, y);
        }
    }
    
    // Detect stars in target image
    let starTargetDetector = new StarDetector();
    starTargetDetector.mask = mask;
    starTargetDetector.sensitivity = Math.pow(10.0, logStarDetectionSensitivity);
    starTargetDetector.upperLimit = upperLimit;
    let tgtStars = starTargetDetector.stars(tgtImage);
    
    // Detect stars in reference image
    let starReferenceDetector = new StarDetector();
    starReferenceDetector.mask = mask;
    starReferenceDetector.sensitivity = Math.pow(10.0, logStarDetectionSensitivity);
    starReferenceDetector.upperLimit = upperLimit;
    let refStars = starTargetDetector.stars(refImage);
    
    console.writeln("\nMatching stars");
    let leastSquareFit = new LeastSquareFitAlgorithm();
    let starPairArray = [];
    for (let ref=0; ref<refStars.length; ref++){
        let x1 = refStars[ref].pos.x;
        let y1 = refStars[ref].pos.y;
        for (let tgt = 0; tgt < tgtStars.length; tgt++){
            let deltaX = x1 - tgtStars[tgt].pos.x;
            let deltaY = y1 - tgtStars[tgt].pos.y;
            if (deltaX < 1 && deltaY < 1 && deltaX*deltaX + deltaY*deltaY < 1){
                let starPair = new StarPair(refStars[ref], tgtStars[tgt]);
                leastSquareFit.addValue(starPair.getTgtFlux(), starPair.getRefFlux());
                starPairArray.push(starPair);
                break;
            }
        }
    }
    console.writeln("Found " + starPairArray.length + " matching stars");
    // We are only interested in the scale, not the intercept.
    // Any intercept would be an artifact of the photometry
    let linearFit= leastSquareFit.getLinearFit();
    linearFit.b = 0;
    return new StarPairs(starPairArray, linearFit);
}

/**
 * The StarDetector does not subtract the background from the star, so we neeed
 * to do this here
 * @param {Star} star
 * @returns {Number} Star flux corrected for background level
 */
function getFlux(star){
    return star.flux - star.bkg * star.size;
}

/**
 * @param {Star} refStar
 * @param {Star} tgtStar
 * @returns {StarPair}
 */
function StarPair(refStar, tgtStar){
    this.tgtStar = tgtStar;
    this.refStar = refStar;
    this.getTgtFlux = function(){
        return getFlux(tgtStar);
    };
    this.getRefFlux = function(){
        return getFlux(refStar);
    };
    this.getTgtX = function(){
        return tgtStar.pos.x;
    };
    this.getTgtY = function(){
        return tgtStar.pos.y;
    };
    this.getRefX = function(){
        return refStar.pos.x;
    };
    this.getRefY = function(){
        return refStar.pos.y;
    };
}

/**
 * Stores the array of StarPair and the LinearFitData that was calculated from them
 * @param {StarPair[]} starPairArray
 * @param {LinearFitData} linearFitData
 * @returns {StarPairs}
 */
function StarPairs(starPairArray, linearFitData){
    this.starPairArray = starPairArray;
    this.linearFitData = linearFitData;
}

/**
 * Calculates the max and min star flux
 * @returns {StarMinMax}
 */
function StarMinMax() {
    this.maxRefFlux = Number.MIN_VALUE;
    this.maxTgtFlux = Number.MIN_VALUE;
    this.minRefFlux = Number.MAX_VALUE; 
    this.minTgtFlux = Number.MAX_VALUE;

    /**
     * Find max and min for the (corrected) star flux 
     * @param {StarPair[]} starPairArray
     * @returns {undefined}
     */
    this.calculateMinMax = function(starPairArray){
        for (let starPair of starPairArray) {
            this.maxRefFlux = Math.max(this.maxRefFlux, getFlux(starPair.refStar));
            this.maxTgtFlux = Math.max(this.maxTgtFlux, getFlux(starPair.tgtStar));
            this.minRefFlux = Math.min(this.minRefFlux, getFlux(starPair.refStar));
            this.minTgtFlux = Math.min(this.minTgtFlux, getFlux(starPair.tgtStar));
        }
    };
}

/**
 * @param {String} refView
 * @param {String} tgtView
 * @param {Number} height
 * @param {StarPairs[]} colorStarPairs StarPairs for L or R,G,B
 * @returns {undefined}
 */
function displayStarGraph(refView, tgtView, height, colorStarPairs){
    let targetName = tgtView.fullId;
    let referenceName = refView.fullId;
    let imageWindow = null;
    let windowTitle = "Photometry__" + targetName + "__and__" + referenceName;
    let targetLabel = "Target (" + targetName + ")";
    let referenceLabel = "Reference (" + referenceName + ")";
    
    // Create the graph axis and annotation.
    let minMax = new StarMinMax();
    colorStarPairs.forEach(function (starPairs) {
        //minMax.calculateMinMax(starPairs.samplePairArray);
        minMax.calculateMinMax(starPairs.starPairArray);
    });
    let graphWithAxis = new Graph(minMax.minTgtFlux, minMax.minRefFlux, minMax.maxTgtFlux, minMax.maxRefFlux);
    graphWithAxis.setYAxisLength(height);
    graphWithAxis.createGraph(targetLabel, referenceLabel);

    // Now add the data to the graph...
    if (colorStarPairs.length === 1){ // B&W
        drawStarLineAndPoints(graphWithAxis, 0xFF777777, colorStarPairs[0], 0xFFFFFFFF);
        imageWindow = graphWithAxis.createWindow(windowTitle, false);
    } else {
        // Color. Need to create 3 graphs for r, g, b and then merge them (binary OR) so that
        // if three samples are on the same pixel we get white and not the last color drawn
        let lineColors = [0xFF770000, 0xFF007700, 0xFF000077]; // r, g, b
        let pointColors = [0xFFFF0000, 0xFF00FF00, 0xFF0000FF]; // r, g, b
        for (let c = 0; c < colorStarPairs.length; c++){
            let graphAreaOnly = graphWithAxis.createGraphAreaOnly();
            drawStarLineAndPoints(graphAreaOnly, lineColors[c], colorStarPairs[c], pointColors[c]);
            graphWithAxis.mergeWithGraphAreaOnly(graphAreaOnly);
        }
        imageWindow = graphWithAxis.createWindow(windowTitle, true);
    }
    
    imageWindow.show();
}

/**
 * Display the detected stars as circles within a mask image
 * @param {View} view Get the dimensions from this image
 * @param {StarPair[]} starPairArray Detected stars
 * @param {Number} channel
 * @param {Boolean} isColor
 * @returns {undefined}
 */
function displayDetectedStars(view, starPairArray, channel, isColor) {
    let title = view.fullId;
    switch (channel) {
        case 0:
            if (isColor){
                title += "_red_stars";
            } else {
                title += "_stars";
            }
            break;
        case 1:
            title += "_green_stars";
            break;
        case 2:
            title += "_blue_stars";
    }
    let image = view.image;
    let bmp = new Bitmap(image.width, image.height);
    bmp.fill(0xffffffff);
    let G = new VectorGraphics(bmp);
    G.antialiasing = true;
    G.pen = new Pen(0xff000000);
    for (let i = 0; i < starPairArray.length; ++i){
        let starPair = starPairArray[i];
        let s = starPair.tgtStar;
        G.strokeCircle(s.pos, Math.max(3, Math.round(Math.sqrt(s.size)) | 1));
    }
    G.end();

    let w = new ImageWindow(bmp.width, bmp.height,
            1, // numberOfChannels
            8, // bitsPerSample
            false, // floatSample
            false, // color
            title);
    w.mainView.beginProcess(UndoFlag_NoSwapFile);
    w.mainView.image.blend(bmp);
    w.mainView.endProcess();
    w.show();
    //w.zoomToFit();
}
    
/**
 * Draw graph lines and points for a single color
 * @param {Graph} graph
 * @param {Number} lineColor e.g. 0xAARRGGBB
 * @param {StarPairs} starPairs Contains the array of SamplePair
 * @param {Number} pointColor e.g. 0xAARRGGBB
 * @returns {undefined}
 */
function drawStarLineAndPoints(graph, lineColor, starPairs, pointColor){
    let linearFit = starPairs.linearFitData;
    graph.drawLine(linearFit.m, linearFit.b, lineColor);
    for (let starPair of starPairs.starPairArray){
        graph.drawPoint(getFlux(starPair.tgtStar), getFlux(starPair.refStar), pointColor);
    }
}

// ====================================
// Example code / usage
// Indexs required to access this data from the StarAlignment output array
//#define NUMBER_OF_PAIR_MATCHES    2
//#define REFERENCE_X              29
//#define REFERENCE_Y              30
//#define TARGET_X                 31
//#define TARGET_Y                 32

// To display header file, type this into Console window:
// open "$PXI_INCDIR/pjsr/StarDetector.jsh"
// 
// PixInsight example code: how to use StarAlignment
//let SA = new StarAlignment;
//if (SA.executeOn(view))
//{
//    let stars = [];
//    let n = SA.outputData[0][NUMBER_OF_PAIR_MATCHES];
//    for (let i = 0; i < n; ++i)
//        stars.push({refX: SA.outputData[0][REFERENCE_X][i],
//            refY: SA.outputData[0][REFERENCE_Y][i],
//            tgtX: SA.outputData[0][TARGET_X][i],
//            tgtY: SA.outputData[0][TARGET_Y][i]});
//}


// PixInsight Star data structure
// 
//    function Star(pos, flux, size)
//    {
//        // Centroid position in pixels, image coordinates.
//        this.pos = new Point(pos.x, pos.y);
//        // Total flux, normalized intensity units.
//        this.flux = flux;
//        // Area of detected star structure in square pixels.
//        this.size = size;
//    }

// PixInsight example to get R.A. & Dec for detected stars
//    var window = ImageWindow.activeWindow;
//    var S = new StarDetector;
//    var stars = S.stars( window.mainView.image );
//    var f = File.createFileForWriting( "/tmp/stars.txt" );
//    f.outTextLn( "Star      X        Y      Flux       R.A.         Dec.    " );
//    f.outTextLn( "===== ======== ======== ======== ============ ============" );
//    for ( let i = 0; i < stars.length; ++i )
//    {
//       let q = window.imageToCelestial( stars[i].pos );
//       f.outTextLn( format( "%5d %8.2f %8.2f %8.3f %12.8f %+12.8f", i, stars[i].pos.x, stars[i].pos.y, stars[i].flux, q.x, q.y ) );
//    }
//    f.close();
    