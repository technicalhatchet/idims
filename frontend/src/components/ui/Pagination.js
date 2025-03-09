import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  const maxVisiblePages = 5;
  
  if (totalPages <= 1) return null;
  
  // Calculate range of visible page numbers
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  // Adjust start page if end page is maxed out
  startPage = Math.max(1, endPage - maxVisiblePages + 1);
  
  // Create array of pages to display
  const pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
  
  return (
    <div className="flex items-center justify-center mt-4">
      <nav className="flex items-center">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-2 py-1 mr-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          <FaChevronLeft />
        </button>
        
        {startPage > 1 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className="px-3 py-1 mx-1 rounded-md hover:bg-gray-100"
              aria-label="Page 1"
            >
              1
            </button>
            {startPage > 2 && <span className="mx-1">...</span>}
          </>
        )}
        
        {pages.map(page => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`px-3 py-1 mx-1 rounded-md ${
              currentPage === page
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-100'
            }`}
            aria-label={`Page ${page}`}
            aria-current={currentPage === page ? 'page' : undefined}
          >
            {page}
          </button>
        ))}
        
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="mx-1">...</span>}
            <button
              onClick={() => onPageChange(totalPages)}
              className="px-3 py-1 mx-1 rounded-md hover:bg-gray-100"
              aria-label={`Page ${totalPages}`}
            >
              {totalPages}
            </button>
          </>
        )}
        
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-2 py-1 ml-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          <FaChevronRight />
        </button>
      </nav>
    </div>
  );
}