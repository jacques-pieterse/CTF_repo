// Wait for OpenCV.js to be ready
let Module = {
  onRuntimeInitialized: function() {
    // OpenCV.js is ready, proceed with the rest of your code
    main();
  }
};

function main() {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // Original maze dimensions
  const originalWidth = 1280;
  const originalHeight = 720;
  const scaleX = canvas.width / originalWidth; // Original width
  const scaleY = canvas.height / originalHeight;  // Original height

  // Apply scaling to the canvas context
  ctx.scale(scaleX, scaleY);

  // **ADDED**: Global variables to store the perspective transform matrix and offsets
  let perspectiveMatrix = null;
  let offsetX = 0;
  let offsetY = 0;

  const ws = new WebSocket('wss://capture-the-flag-vlhp.onrender.com');

  const carColors = {
    red: 'red',
    yellow: 'yellow',
    purple: 'purple',
    blue: 'blue'
  };

  let cars = {}; // Current positions
  let targetPositions = {}; // Target positions for animation
  let paths = {};
  let animationStartTime = null;
  const animationDuration = 500; // Animation duration in milliseconds

  let mazeBitmap = null;

  const errorOverlay = document.getElementById('errorOverlay');

  ws.onopen = () => {
    console.log('Connected to WebSocket server');
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Data received:', data); // Log received data

    if (data.type === 'mazeData') {
      console.log('Maze data received:', data); // Log maze data

      // Decode RLE data
      const width = data.width;
      const height = data.height;
      const rleData = data.rleData;

      // Reconstruct the maze data from RLE
      const mazeData = new Uint8ClampedArray(width * height);
      let dataIndex = 0;
      rleData.forEach(run => {
        const [value, count] = run;
        mazeData.fill(value, dataIndex, dataIndex + count);
        dataIndex += count;
      });

      // Process the maze image using OpenCV.js
      processMazeImage(mazeData, width, height).then((processedMazeBitmap) => {
        console.log('Maze image processed successfully');
        mazeBitmap = processedMazeBitmap;
        draw(); // Initial draw after processing the maze
      }).catch((err) => {
        console.error('Error processing maze image:', err);
        displayError(`Error processing maze image: ${err.message}`);
      });

    } else {
      // Handle other types of data (e.g., car positions and paths)
      if (data.cars) {
        for (const color in data.cars) {
          const newPosition = data.cars[color];

          // **UPDATED**: Transform the car position
          const transformedPosition = transformPoint(newPosition.x, newPosition.y);

          // **ADDED**: Transform orientation if available
          if (newPosition.orientation !== undefined) {
            transformedPosition.orientation = transformOrientation(newPosition.orientation);
          }

          // Initialize car position if it doesn't exist
          if (!cars[color]) {
            cars[color] = { ...transformedPosition };
          }

          // Set target position
          targetPositions[color] = { ...transformedPosition };

          // Start animation
          animationStartTime = performance.now();
        }
      }
      if (data.paths) {
        for (const color in data.paths) {
          // **UPDATED**: Transform each point in the path
          const transformedPath = data.paths[color].map(pt => transformPoint(pt.x, pt.y));
          paths[color] = transformedPath;
        }
      }

      // Start the animation loop
      requestAnimationFrame(animate);
    }
  };

  /**
   * **UPDATED**: Function to transform a point using the perspective matrix and offsets
   * Transforms (x, y) from the original image to the warped maze
   * Applies the perspective transformation, offsets, and scaling
   * @param {number} x - Original x-coordinate
   * @param {number} y - Original y-coordinate
   * @returns {Object} - Transformed coordinates {x: newX, y: newY}
   */
  function transformPoint(x, y) {
    if (!perspectiveMatrix) {
      console.warn('Perspective matrix not available. Using scaled coordinates.');
      return { x: x * scaleX, y: y * scaleY }; // Fallback: apply scaling only
    }

    // Create a Mat for the source point
    let srcPoint = cv.matFromArray(1, 1, cv.CV_32FC2, [x, y]);

    // Create an empty Mat for the destination point
    let dstPoint = new cv.Mat();

    // Apply the perspective transform
    cv.perspectiveTransform(srcPoint, dstPoint, perspectiveMatrix);

    // Retrieve the transformed coordinates and apply offsets
    let newX = dstPoint.floatAt(0, 0) + offsetX;
    let newY = dstPoint.floatAt(0, 1) + offsetY;

    // Apply scaling
    newX *= scaleX;
    newY *= scaleY;

    // Cleanup
    srcPoint.delete();
    dstPoint.delete();

    return { x: newX, y: newY };
  }

  /**
   * **UPDATED**: Function to transform orientation based on the perspective matrix and offsets
   * @param {number} angle - Original orientation angle in degrees
   * @returns {number} - Transformed orientation angle in degrees
   */
  function transformOrientation(angle) {
    if (!perspectiveMatrix) {
      console.warn('Perspective matrix not available. Using original orientation.');
      return angle; // Fallback: return original angle
    }

    // Convert angle to radians
    let angleRad = (angle * Math.PI) / 180;

    // Create a unit vector based on the angle
    let vector = [Math.cos(angleRad), Math.sin(angleRad)];

    // Create a Mat for the source vector (as a point)
    let srcVector = cv.matFromArray(1, 1, cv.CV_32FC2, vector);

    // Create an empty Mat for the transformed vector
    let dstVector = new cv.Mat();

    // Apply the perspective transform
    cv.perspectiveTransform(srcVector, dstVector, perspectiveMatrix);

    // Retrieve the transformed vector
    let transformedX = dstVector.floatAt(0, 0);
    let transformedY = dstVector.floatAt(0, 1);

    // Calculate the new angle
    let newAngleRad = Math.atan2(transformedY, transformedX);
    let newAngle = (newAngleRad * 180) / Math.PI;

    // Normalize the angle between 0-360 degrees
    newAngle = (newAngle + 360) % 360;

    // Cleanup
    srcVector.delete();
    dstVector.delete();

    return newAngle;
  }

  function animate(timestamp) {
    if (!animationStartTime) {
      animationStartTime = timestamp;
    }
    const progress = Math.min((timestamp - animationStartTime) / animationDuration, 1);

    // Interpolate positions
    for (const color in cars) {
      if (targetPositions[color]) {
        const currentPos = cars[color];
        const targetPos = targetPositions[color];
        currentPos.x = currentPos.x + (targetPos.x - currentPos.x) * progress;
        currentPos.y = currentPos.y + (targetPos.y - currentPos.y) * progress;
        // Optional: Handle orientation if needed
        if (currentPos.orientation !== undefined && targetPos.orientation !== undefined) {
          currentPos.orientation = currentPos.orientation + (targetPos.orientation - currentPos.orientation) * progress;
        }
      }
    }

    draw();

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Animation complete, set current positions to target positions
      for (const color in cars) {
        if (targetPositions[color]) {
          cars[color] = { ...targetPositions[color] };
        }
      }
      // Clear target positions
      targetPositions = {};
      animationStartTime = null;
    }
  }

  function draw() {
    console.log('Drawing frame'); // Log when draw is called
    // Clear canvas
    ctx.clearRect(0, 0, originalWidth, originalHeight);

    // Draw maze if available
    if (mazeBitmap) {
      ctx.drawImage(mazeBitmap, 0, 0, originalWidth, originalHeight);
    }

    // Draw paths
    for (const color in paths) {
      const path = paths[color];
      ctx.strokeStyle = carColors[color];
      ctx.lineWidth = 2 / scaleX; // Adjust line width based on scaling
      ctx.beginPath();
      if (path.length > 0) {
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
          ctx.lineTo(path[i].x, path[i].y);
        }
      }
      ctx.stroke();
    }

    // Draw cars
    for (const color in cars) {
      const position = cars[color];
      ctx.fillStyle = carColors[color];
      ctx.beginPath();
      ctx.arc(position.x, position.y, 25, 0, 2 * Math.PI);
      ctx.fill();

      // Draw orientation line
      if (position.orientation !== undefined) {
        const angleRad = (position.orientation * Math.PI) / 180; // Convert to radians
        const lineLength = 25;
        const endX = position.x + lineLength * Math.cos(angleRad);
        const endY = position.y + lineLength * Math.sin(angleRad);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2 / scaleX; // Adjust line width based on scaling
        ctx.beginPath();
        ctx.moveTo(position.x, position.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
    }
  }

  /**
   * **UPDATED**: Function to process the maze image using OpenCV.js with Edge Detection
   */
  async function processMazeImage(mazeData, width, height) {
    return new Promise((resolve, reject) => {
      console.log('Starting maze image processing'); // Log start of processing

      // Initialize variables outside the try block for access in catch
      let contours = null;
      let hierarchy = null;
      let largestContour = null;
      let approx = null;
      let srcTri = null;
      let dstTri = null;
      let M = null;

      // Create an OpenCV Mat from the maze data
      let src = cv.matFromArray(height, width, cv.CV_8UC1, mazeData);
      let dst = new cv.Mat();

      try {
        // 1. Apply Gaussian Blur to reduce noise
        let blurred = new cv.Mat();
        cv.GaussianBlur(src, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
        // 3. Apply Morphological Operations to close gaps and remove small artifacts

        // Define a larger kernel for closing gaps
        let kernelClose = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
        // Perform Closing (Dilation followed by Erosion) to close gaps in the maze walls
        cv.morphologyEx(blurred, blurred, cv.MORPH_CLOSE, kernelClose, new cv.Point(-1, -1), 7);
        kernelClose.delete(); // Free memory

        // Define a smaller kernel for opening
        let kernelOpen = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
        // Perform Opening (Erosion followed by Dilation) to remove small artifacts
        cv.morphologyEx(blurred, blurred, cv.MORPH_OPEN, kernelOpen, new cv.Point(-1, -1), 6);
        kernelOpen.delete(); // Free memory

        // Optional: Further Erosion to refine the maze walls
        let kernelErode = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
        cv.erode(blurred, blurred, kernelErode, new cv.Point(-1, -1), 3);
        kernelErode.delete(); // Free memory

        // 2. Apply Canny Edge Detection
        let edges = new cv.Mat();
        const lowThreshold = 50;
        const highThreshold = 150;
        cv.Canny(blurred, edges, lowThreshold, highThreshold);
        console.log('Canny edge detection applied');
        blurred.delete(); // Free memory

        // 4. Find contours based on the edges
        contours = new cv.MatVector();
        hierarchy = new cv.Mat();
        cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        console.log('Contours found:', contours.size());

        edges.delete(); // Free memory

        // 5. Find the largest contour that does NOT touch the image borders
        let maxArea = 0;
        for (let i = 0; i < contours.size(); i++) {
          let cnt = contours.get(i);
          let area = cv.contourArea(cnt);
          console.log(`Contour ${i} Area: ${area}`);
          if (area > maxArea) {
            let rect = cv.boundingRect(cnt);
            const margin = 20;
            if (
              rect.x > margin &&
              rect.y > margin &&
              rect.x + rect.width < width - margin &&
              rect.y + rect.height < height - margin
            ) {
              maxArea = area;
              largestContour = cnt;
            }
          }
        }

        if (!largestContour) {
          console.warn('No suitable contours found. Using the original image without transformation.');
          // **ADDED**: Use the original image without transformation
          // Convert the original mazeData to RGBA ImageData
          let originalImageData = new ImageData(new Uint8ClampedArray(mazeData.length * 4), width, height);
          for (let i = 0; i < mazeData.length; i++) {
            originalImageData.data[i * 4] = mazeData[i];     // R
            originalImageData.data[i * 4 + 1] = mazeData[i]; // G
            originalImageData.data[i * 4 + 2] = mazeData[i]; // B
            originalImageData.data[i * 4 + 3] = 255;        // A
          }

          createImageBitmap(originalImageData).then((bitmap) => {
            console.log('Original maze bitmap created without transformation.');
            // Clean up
            src.delete();
            dst.delete();
            originalImageData = null; // Let GC handle it
            if (contours) contours.delete();
            if (hierarchy) hierarchy.delete();
            // No need to delete largestContour as it's null
            resolve(bitmap);
          }).catch((err) => {
            console.error('Error creating ImageBitmap from original image:', err);
            // Clean up
            src.delete();
            dst.delete();
            if (contours) contours.delete();
            if (hierarchy) hierarchy.delete();
            reject(err);
          });
          return; // Exit the function early
        }
        console.log('Largest suitable contour area:', maxArea);

        // 6. Approximate the contour to a polygon
        approx = new cv.Mat();
        cv.approxPolyDP(largestContour, approx, 0.02 * cv.arcLength(largestContour, true), true);
        console.log('Approximated polygon points:', approx.rows);

        if (approx.rows !== 4) {
          console.warn(`Maze contour does not have 4 corners. Detected points: ${approx.rows}. Using the original image without transformation.`);
          // **ADDED**: Use the original image without transformation
          // Convert the original mazeData to RGBA ImageData
          let originalImageData = new ImageData(new Uint8ClampedArray(mazeData.length * 4), width, height);
          for (let i = 0; i < mazeData.length; i++) {
            originalImageData.data[i * 4] = mazeData[i];     // R
            originalImageData.data[i * 4 + 1] = mazeData[i]; // G
            originalImageData.data[i * 4 + 2] = mazeData[i]; // B
            originalImageData.data[i * 4 + 3] = 255;        // A
          }

          createImageBitmap(originalImageData).then((bitmap) => {
            console.log('Original maze bitmap created without transformation.');
            // Clean up
            src.delete();
            dst.delete();
            originalImageData = null; // Let GC handle it
            if (contours) contours.delete();
            if (hierarchy) hierarchy.delete();
            if (largestContour) largestContour.delete();
            if (approx) approx.delete();
            resolve(bitmap);
          }).catch((err) => {
            console.error('Error creating ImageBitmap from original image:', err);
            // Clean up
            src.delete();
            dst.delete();
            if (contours) contours.delete();
            if (hierarchy) hierarchy.delete();
            if (largestContour) largestContour.delete();
            if (approx) approx.delete();
            reject(err);
          });
          return; // Exit the function early
        }

        // 7. Get the corner points
        let cornerPoints = [];
        for (let i = 0; i < 4; i++) {
          cornerPoints.push({
            x: approx.intPtr(i, 0)[0],
            y: approx.intPtr(i, 0)[1],
          });
        }
        console.log('Corner points:', cornerPoints);

        // 8. Order the corner points (top-left, top-right, bottom-right, bottom-left)
        cornerPoints = orderCornerPoints(cornerPoints);
        console.log('Ordered corner points:', cornerPoints);

        // 9. Compute the perspective transformation matrix
        srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
          cornerPoints[0].x, cornerPoints[0].y,
          cornerPoints[1].x, cornerPoints[1].y,
          cornerPoints[2].x, cornerPoints[2].y,
          cornerPoints[3].x, cornerPoints[3].y,
        ]);

        dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
          0,
          0,
          width,
          0,
          width,
          height,
          0,
          height,
        ]);

        M = cv.getPerspectiveTransform(srcTri, dstTri);
        console.log('Perspective transform matrix computed');

        // **ADDED**: Clone and store the perspective matrix
        if (perspectiveMatrix) {
          perspectiveMatrix.delete(); // Delete previous matrix to prevent memory leaks
        }
        perspectiveMatrix = M.clone();
        console.log('Perspective matrix stored for transforming positions');

        // 10. Warp the image to get the corrected maze
        cv.warpPerspective(src, dst, M, new cv.Size(width, height));
        console.log('Image warped successfully');

        // 14. Calculate the bounding rectangle of the warped maze to determine offsets
        let warpedContours = new cv.MatVector();
        let warpedHierarchy = new cv.Mat();
        cv.findContours(dst, warpedContours, warpedHierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        if (warpedContours.size() === 0) {
          console.warn('No contours found in warped image to calculate offsets. Using the original image without transformation.');
          // **ADDED**: Use the original image without transformation
          // Convert the original mazeData to RGBA ImageData
          let originalImageData = new ImageData(new Uint8ClampedArray(mazeData.length * 4), width, height);
          for (let i = 0; i < mazeData.length; i++) {
            originalImageData.data[i * 4] = mazeData[i];     // R
            originalImageData.data[i * 4 + 1] = mazeData[i]; // G
            originalImageData.data[i * 4 + 2] = mazeData[i]; // B
            originalImageData.data[i * 4 + 3] = 255;        // A
          }

          createImageBitmap(originalImageData).then((bitmap) => {
            console.log('Original maze bitmap created without transformation.');
            // Clean up
            src.delete();
            dst.delete();
            originalImageData = null; // Let GC handle it
            warpedContours.delete();
            warpedHierarchy.delete();
            // Do not delete largestContour as it's already used
            resolve(bitmap);
          }).catch((err) => {
            console.error('Error creating ImageBitmap from original image:', err);
            // Clean up
            src.delete();
            dst.delete();
            warpedContours.delete();
            warpedHierarchy.delete();
            reject(err);
          });
          return; // Exit the function early
        }

        // Assuming the largest contour corresponds to the maze
        let maxWarpedArea = 0;
        let warpedLargestContour = null;
        for (let i = 0; i < warpedContours.size(); i++) {
          let cnt = warpedContours.get(i);
          let area = cv.contourArea(cnt);
          if (area > maxWarpedArea) {
            maxWarpedArea = area;
            warpedLargestContour = cnt;
          }
        }

        if (!warpedLargestContour) {
          console.warn('No suitable contours found in warped image to calculate offsets. Using the original image without transformation.');
          // **ADDED**: Use the original image without transformation
          // Convert the original mazeData to RGBA ImageData
          let originalImageData = new ImageData(new Uint8ClampedArray(mazeData.length * 4), width, height);
          for (let i = 0; i < mazeData.length; i++) {
            originalImageData.data[i * 4] = mazeData[i];     // R
            originalImageData.data[i * 4 + 1] = mazeData[i]; // G
            originalImageData.data[i * 4 + 2] = mazeData[i]; // B
            originalImageData.data[i * 4 + 3] = 255;        // A
          }

          createImageBitmap(originalImageData).then((bitmap) => {
            console.log('Original maze bitmap created without transformation.');
            // Clean up
            src.delete();
            dst.delete();
            originalImageData = null; // Let GC handle it
            warpedContours.delete();
            warpedHierarchy.delete();
            warpedLargestContour.delete();
            resolve(bitmap);
          }).catch((err) => {
            console.error('Error creating ImageBitmap from original image:', err);
            // Clean up
            src.delete();
            dst.delete();
            warpedContours.delete();
            warpedHierarchy.delete();
            warpedLargestContour.delete();
            reject(err);
          });
          return; // Exit the function early
        }

        let warpedBoundingRect = cv.boundingRect(warpedLargestContour);
        offsetX = warpedBoundingRect.x;
        offsetY = warpedBoundingRect.y;

        console.log(`Calculated offsets - X: ${offsetX}, Y: ${offsetY}`);

        // Cleanup
        warpedContours.delete();
        warpedHierarchy.delete();
        warpedLargestContour.delete();

        // 11. Convert the result to RGBA
        let dstRGBA = new cv.Mat();
        cv.cvtColor(dst, dstRGBA, cv.COLOR_GRAY2RGBA);
        console.log('Converted warped image to RGBA');

        // 12. Convert the RGBA image to ImageData
        let dstData = new Uint8ClampedArray(dstRGBA.data);
        let processedMazeData = new ImageData(dstData, dstRGBA.cols, dstRGBA.rows);

        // 13. Create a bitmap for drawing
        createImageBitmap(processedMazeData).then((bitmap) => {
          console.log('Maze bitmap created:', bitmap);
          // Clean up
          src.delete();
          dst.delete();
          dstRGBA.delete();
          if (contours) contours.delete();
          if (hierarchy) hierarchy.delete();
          if (largestContour) largestContour.delete();
          if (approx) approx.delete();
          if (srcTri) srcTri.delete();
          if (dstTri) dstTri.delete();
          // **ADDED**: Do not delete M here as it's cloned to perspectiveMatrix
          // M.delete(); // Do not delete M since we cloned it

          resolve(bitmap);
        }).catch((err) => {
          console.error('Error creating ImageBitmap:', err);
          // Clean up
          src.delete();
          dst.delete();
          dstRGBA.delete();
          if (contours) contours.delete();
          if (hierarchy) hierarchy.delete();
          if (largestContour) largestContour.delete();
          if (approx) approx.delete();
          if (srcTri) srcTri.delete();
          if (dstTri) dstTri.delete();
          if (M) M.delete();

          reject(err);
        });
      } catch (err) {
        console.error('Exception in processing maze image:', err);
        displayError(`Error processing maze image: ${err.message}`);
        // **ADDED**: Use the original image without transformation
        // Convert the original mazeData to RGBA ImageData
        let originalImageData = new ImageData(new Uint8ClampedArray(mazeData.length * 4), width, height);
        for (let i = 0; i < mazeData.length; i++) {
          originalImageData.data[i * 4] = mazeData[i];     // R
          originalImageData.data[i * 4 + 1] = mazeData[i]; // G
          originalImageData.data[i * 4 + 2] = mazeData[i]; // B
          originalImageData.data[i * 4 + 3] = 255;        // A
        }

        createImageBitmap(originalImageData).then((bitmap) => {
          console.log('Original maze bitmap created without transformation due to error.');
          // Clean up
          src.delete();
          dst.delete();
          originalImageData = null; // Let GC handle it
          if (contours) contours.delete();
          if (hierarchy) hierarchy.delete();
          if (largestContour) largestContour.delete();
          if (approx) approx.delete();
          if (srcTri) srcTri.delete();
          if (dstTri) dstTri.delete();
          if (M) M.delete();
          resolve(bitmap); // Resolve with original image despite the error
        }).catch((bitmapErr) => {
          console.error('Error creating ImageBitmap from original image after failure:', bitmapErr);
          // Clean up
          src.delete();
          dst.delete();
          originalImageData = null; // Let GC handle it
          if (contours) contours.delete();
          if (hierarchy) hierarchy.delete();
          if (largestContour) largestContour.delete();
          if (approx) approx.delete();
          if (srcTri) srcTri.delete();
          if (dstTri) dstTri.delete();
          if (M) M.delete();
          reject(bitmapErr);
        });
      }
    });
  }

  /**
   * Helper function to order corner points consistently.
   * Orders them as top-left, top-right, bottom-right, bottom-left.
   */
  function orderCornerPoints(corners) {
    // Calculate the sum and difference of the points to find corners
    let sums = corners.map(pt => pt.x + pt.y);
    let diffs = corners.map(pt => pt.y - pt.x);

    // Top-left point has the smallest sum
    let tlIndex = sums.indexOf(Math.min(...sums));
    let tl = corners[tlIndex];

    // Bottom-right point has the largest sum
    let brIndex = sums.indexOf(Math.max(...sums));
    let br = corners[brIndex];

    // Top-right point has the smallest difference
    let trIndex = diffs.indexOf(Math.min(...diffs));
    let tr = corners[trIndex];

    // Bottom-left point has the largest difference
    let blIndex = diffs.indexOf(Math.max(...diffs));
    let bl = corners[blIndex];

    return [tl, tr, br, bl];
  }

  /**
   * Function to display errors to the user
   */
  function displayError(message) {
    const errorDiv = document.getElementById('errorOverlay');
    errorDiv.innerText = message;
    errorDiv.style.display = 'block';
    // Hide after 5 seconds
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 5000);
  }
}
