import cv2
import numpy as np
import matplotlib.pyplot as plt

def read_image(path):
    """
    Reads an image from the specified path in grayscale.
    """
    image = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise FileNotFoundError(f"Image at path '{path}' not found.")
    return image

def gaussian_blur(image, kernel_size=(5, 5)):
    """
    Applies Gaussian Blur to reduce noise.
    """
    blurred = cv2.GaussianBlur(image, kernel_size, 0)
    return blurred

def morphological_operations(image, close_kernel_size=(5,5), open_kernel_size=(3,3), erosion_kernel_size=(3,3)):
    """
    Applies Closing, Opening, and Erosion to clean up the image before edge detection.
    """
    # Closing: Fill small holes and gaps
    kernel_close = cv2.getStructuringElement(cv2.MORPH_RECT, close_kernel_size)
    closed = cv2.morphologyEx(image, cv2.MORPH_CLOSE, kernel_close, iterations=6)
    
    # Opening: Remove small noise and artifacts
    kernel_open = cv2.getStructuringElement(cv2.MORPH_RECT, open_kernel_size)
    opened = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel_open, iterations=4)
    
    # Additional Erosion: Refine edges
    kernel_erode = cv2.getStructuringElement(cv2.MORPH_RECT, erosion_kernel_size)
    eroded = cv2.erode(opened, kernel_erode, iterations=3)
    
    return eroded

def canny_edge_detection(image, low_threshold=50, high_threshold=150):
    """
    Applies Canny Edge Detection on the pre-processed image.
    """
    edges = cv2.Canny(image, low_threshold, high_threshold)
    return edges

def find_contours(processed_image):
    """
    Finds contours in the processed image.
    """
    contours, hierarchy = cv2.findContours(processed_image, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return contours

def filter_contours(contours, image_shape, margin=20):
    """
    Filters out contours that touch the image borders based on the specified margin.
    Returns the largest suitable contour.
    """
    height, width = image_shape
    max_area = 0
    largest_contour = None
    
    for cnt in contours:
        area = cv2.contourArea(cnt)
        print(area)
        if area > max_area:
            x, y, w, h = cv2.boundingRect(cnt)
            # Check if contour is away from the image borders
            if (x > margin and y > margin and
                x + w < width - margin and
                y + h < height - margin):
                max_area = area
                largest_contour = cnt
                
    return largest_contour

def approximate_polygon(contour, epsilon_factor=0.02):
    """
    Approximates a contour to a polygon with fewer vertices.
    """
    peri = cv2.arcLength(contour, True)
    epsilon = epsilon_factor * peri
    approx = cv2.approxPolyDP(contour, epsilon, True)
    return approx

def order_corner_points(corners):
    """
    Orders corner points in the order: top-left, top-right, bottom-right, bottom-left.
    """
    # Convert to a list of tuples
    corners = [tuple(pt[0]) for pt in corners]
    
    # Initialize a list of coordinates that will be ordered
    ordered = [None] * 4
    
    # Sum and difference to find corners
    s = [pt[0] + pt[1] for pt in corners]
    d = [pt[1] - pt[0] for pt in corners]
    
    ordered[0] = corners[np.argmin(s)]  # Top-left
    ordered[2] = corners[np.argmax(s)]  # Bottom-right
    ordered[1] = corners[np.argmin(d)]  # Top-right
    ordered[3] = corners[np.argmax(d)]  # Bottom-left
    
    return ordered

def perspective_transform(image, src_pts, dst_size):
    """
    Applies perspective transformation to the image based on source points.
    """
    dst_width, dst_height = dst_size
    dst_pts = np.array([
        [0, 0],
        [dst_width - 1, 0],
        [dst_width - 1, dst_height - 1],
        [0, dst_height - 1]
    ], dtype="float32")
    
    src_pts = np.array(src_pts, dtype="float32")
    
    # Compute the perspective transform matrix
    M = cv2.getPerspectiveTransform(src_pts, dst_pts)
    
    # Apply the warp perspective
    warped = cv2.warpPerspective(image, M, (dst_width, dst_height))
    
    return warped

def convert_to_rgba(image):
    """
    Converts a grayscale or BGR image to RGBA.
    """
    if len(image.shape) == 2:
        # Grayscale to RGBA
        rgba = cv2.cvtColor(image, cv2.COLOR_GRAY2RGBA)
    elif len(image.shape) == 3 and image.shape[2] == 3:
        # BGR to RGBA
        rgba = cv2.cvtColor(image, cv2.COLOR_BGR2RGBA)
    else:
        raise ValueError("Unsupported image format for RGBA conversion.")
    return rgba

def visualize_intermediate_steps(original, blurred, morphed, edges, contour_image=None, warped=None):
    """
    Displays intermediate processing steps using matplotlib.
    """
    plt.figure(figsize=(20, 10))
    
    plt.subplot(2,3,1)
    plt.title('Original Image')
    plt.imshow(original, cmap='gray')
    plt.axis('off')
    
    plt.subplot(2,3,2)
    plt.title('Gaussian Blurred')
    plt.imshow(blurred, cmap='gray')
    plt.axis('off')
    
    plt.subplot(2,3,3)
    plt.title('After Morphological Operations')
    plt.imshow(morphed, cmap='gray')
    plt.axis('off')
    
    plt.subplot(2,3,4)
    plt.title('Canny Edges')
    plt.imshow(edges, cmap='gray')
    plt.axis('off')
    
    if contour_image is not None:
        plt.subplot(2,3,5)
        plt.title('Contours')
        plt.imshow(contour_image, cmap='gray')
        plt.axis('off')
    
    if warped is not None:
        plt.subplot(2,3,6)
        plt.title('Final Warped Maze with Corners')
        plt.imshow(warped)
        plt.axis('off')
    
    plt.tight_layout()
    plt.show()

def process_maze_image(image_path, output_path=None, visualize=False):
    """
    Complete pipeline to process the maze image with morphological operations before edge detection.
    Draws red circles around all detected corners.
    """
    # Step 1: Read Image
    original = read_image(image_path)
    
    # Step 2: Gaussian Blur
    blurred = gaussian_blur(original)
    
    # Step 3: Morphological Operations BEFORE Edge Detection
    morphed = morphological_operations(blurred)
    
    # Step 4: Canny Edge Detection
    edges = canny_edge_detection(morphed)
    
    # Optional Visualization
    if visualize:
        visualize_intermediate_steps(original, blurred, morphed, edges)
    
    # Step 5: Find Contours
    contours = find_contours(edges)
    
    # Optional Visualization of Contours
    if visualize:
        contour_image = np.zeros_like(original)
        cv2.drawContours(contour_image, contours, -1, (255, 255, 255), 2)
        visualize_intermediate_steps(original, blurred, morphed, edges, contour_image)
    
    # Step 6: Filter Contours
    largest_contour = filter_contours(contours, original.shape)
    
    if largest_contour is None:
        raise ValueError("No suitable contours found. Ensure the maze has a distinct boundary away from image edges.")
    
    # Step 7: Approximate to Polygon
    approx = approximate_polygon(largest_contour)
    
    # Proceed even if the number of points is not 4
    num_corners = len(approx)
    print(f"Detected number of corners: {num_corners}")
    
    # Step 8: Order Corner Points (only if at least one corner is detected)
    if num_corners >= 1:
        ordered_corners = order_corner_points(approx[:4]) if num_corners >=4 else [tuple(pt[0]) for pt in approx]
        print(f"Ordered corners: {ordered_corners}")
    else:
        ordered_corners = []
        print("No corners detected.")
    
    # Step 9: Perspective Transformation (only if exactly 4 corners are detected)
    if num_corners == 4:
        warped = perspective_transform(original, ordered_corners, (1280, 720))  # Adjust dst_size as needed
        
        # Step 10: Convert to BGR for Colored Drawing
        warped_bgr = cv2.cvtColor(warped, cv2.COLOR_GRAY2BGR)
        
        # Step 11: Draw Red Circles Around All Detected Corners
        for point in ordered_corners:
            cv2.circle(warped_bgr, point, radius=10, color=(0, 0, 255), thickness=-1)  # Red color in BGR
        
        # Step 12: Convert to RGBA (for consistency with webapp)
        warped_rgba = convert_to_rgba(warped_bgr)
        
        # Step 13: Save the warped image with corners if output path is provided
        if output_path:
            # Convert RGBA to BGRA for OpenCV before saving
            warped_bgra = cv2.cvtColor(warped_rgba, cv2.COLOR_RGBA2BGRA)
            cv2.imwrite(output_path, warped_bgra)
            print(f"Processed maze image with corners saved to '{output_path}'.")
        
        # Step 14: Display the final processed maze with corners
        if visualize:
            visualize_intermediate_steps(original, blurred, morphed, edges, contour_image=None, warped=warped_rgba)
        
        return warped_rgba
    else:
        # If not exactly 4 corners, still draw circles on the original image
        # Convert original to BGR for colored drawing
        original_bgr = cv2.cvtColor(original, cv2.COLOR_GRAY2BGR)
        
        for point in ordered_corners:
            cv2.circle(original_bgr, point, radius=10, color=(0, 0, 255), thickness=-1)  # Red color in BGR
        
        # Convert to RGBA
        original_rgba = convert_to_rgba(original_bgr)
        
        # Save the image with circles if output path is provided
        if output_path:
            # Convert RGBA to BGRA for OpenCV before saving
            original_bgra = cv2.cvtColor(original_rgba, cv2.COLOR_RGBA2BGRA)
            cv2.imwrite(output_path, original_bgra)
            print(f"Processed maze image with detected corners saved to '{output_path}'.")
        
        # Display the image with circles
        if visualize:
            visualize_intermediate_steps(original, blurred, morphed, edges, contour_image=None, warped=original_rgba)
        
        return original_rgba

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Process a maze image and display the result with detected corners highlighted.")
    parser.add_argument('image_path', type=str, help='Path to the input maze image.')
    parser.add_argument('--output', type=str, default=None, help='Path to save the processed maze image with corners.')
    parser.add_argument('--visualize', action='store_true', help='Visualize intermediate processing steps.')
    
    args = parser.parse_args()
    
    try:
        processed_maze = process_maze_image(args.image_path, args.output, args.visualize)
        print("Maze processing completed successfully.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
