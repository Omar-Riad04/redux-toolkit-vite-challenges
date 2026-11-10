
import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from './app/store';
import {
  setQuery,
  toggleCategory,
  toggleBrand,
  setMinPrice,
  setMaxPrice,
  setMinRating,
  setAvailability,
  setSortBy,
  setPage,
  setPageSize,
  setFiltersFromUrl,
  resetFilters,
  selectFilters,
  selectPaginatedProducts,
  selectSortedProducts,
  selectTotalPages,
  selectCategoryFacets,
  selectBrandFacets,
  type CatalogFilters,
  type Availability,
  type SortOption,
} from './features/catalogSlice';
import './style.css';

const categories = ['Shoes', 'Bags', 'Accessories'];
const brands = ['Peak', 'Path', 'Swift', 'Pulse'];

function readFiltersFromUrl(): Partial<CatalogFilters> {
  const params = new URLSearchParams(window.location.search);

  const numberOrNull = (value: string | null) => {
    if (value === null || value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };

  const validSorts: SortOption[] = [
    'featured',
    'price-asc',
    'price-desc',
    'rating-desc',
    'name-asc',
  ];

  const availability = params.get('availability');
  const sortBy = params.get('sort') as SortOption | null;
  const rating = Number(params.get('rating') ?? 0);
  const page = Number(params.get('page') ?? 1);
  const pageSize = Number(params.get('pageSize') ?? 6);

  return {
    query: params.get('q') ?? '',
    categories: params.getAll('category'),
    brands: params.getAll('brand'),
    minPrice: numberOrNull(params.get('min')),
    maxPrice: numberOrNull(params.get('max')),
    minRating:
      Number.isFinite(rating) && rating >= 0 && rating <= 5 ? rating : 0,
    availability:
      availability === 'in-stock' || availability === 'out-of-stock'
        ? availability
        : 'all',
    sortBy: sortBy && validSorts.includes(sortBy) ? sortBy : 'featured',
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize:
      Number.isInteger(pageSize) && pageSize > 0
        ? Math.min(pageSize, 50)
        : 6,
  };
}

function writeFiltersToUrl(filters: CatalogFilters) {
  const params = new URLSearchParams();

  if (filters.query) params.set('q', filters.query);

  filters.categories.forEach(category =>
    params.append('category', category),
  );

  filters.brands.forEach(brand => params.append('brand', brand));

  if (filters.minPrice !== null) {
    params.set('min', String(filters.minPrice));
  }

  if (filters.maxPrice !== null) {
    params.set('max', String(filters.maxPrice));
  }

  if (filters.minRating > 0) {
    params.set('rating', String(filters.minRating));
  }

  if (filters.availability !== 'all') {
    params.set('availability', filters.availability);
  }

  if (filters.sortBy !== 'featured') {
    params.set('sort', filters.sortBy);
  }

  if (filters.page !== 1) params.set('page', String(filters.page));
  if (filters.pageSize !== 6) {
    params.set('pageSize', String(filters.pageSize));
  }

  const queryString = params.toString();
  const newUrl = queryString
    ? `${window.location.pathname}?${queryString}`
    : window.location.pathname;

  window.history.pushState({}, '', newUrl);
}

export default function App() {
  const dispatch = useAppDispatch();

  const filters = useAppSelector(selectFilters);
  const products = useAppSelector(selectPaginatedProducts);
  const allFilteredProducts = useAppSelector(selectSortedProducts);
  const totalPages = useAppSelector(selectTotalPages);
  const categoryFacets = useAppSelector(selectCategoryFacets);
  const brandFacets = useAppSelector(selectBrandFacets);

  const skipNextUrlWrite = useRef(false);

  // Restore URL filters on initial load and browser back/forward.
  useEffect(() => {
    const restoreFromUrl = () => {
      skipNextUrlWrite.current = true;
      dispatch(setFiltersFromUrl(readFiltersFromUrl()));
    };

    restoreFromUrl();

    window.addEventListener('popstate', restoreFromUrl);

    return () => {
      window.removeEventListener('popstate', restoreFromUrl);
    };
  }, [dispatch]);

  // Keep the URL updated whenever filters or pagination change.
  useEffect(() => {
    if (skipNextUrlWrite.current) {
      skipNextUrlWrite.current = false;
      return;
    }

    writeFiltersToUrl(filters);
  }, [filters]);

  const invalidPriceRange =
    filters.minPrice !== null &&
    filters.maxPrice !== null &&
    filters.minPrice > filters.maxPrice;

  const toggleCategoryFilter = (category: string) => {
    dispatch(toggleCategory(category));
  };

  const toggleBrandFilter = (brand: string) => {
    dispatch(toggleBrand(brand));
  };

  return (
    <main className="container">
      <p className="eyebrow">Redux Toolkit · Challenge 06 · Medium–Hard</p>

      <h1>Advanced Product Filtering Lab</h1>

      <p className="subtitle">
        Memoized selectors, composed filters, URL state
      </p>

      <div className="catalog-layout">
        <aside
          className="panel filters-panel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >           <div className="section-heading">
            <h2>Filters</h2>
            <button type="button" onClick={() => dispatch(resetFilters())}>
              Reset all
            </button>
          </div>

          <label htmlFor="search">Search products</label>
          <input
            id="search"
            type="search"
            placeholder="Search name, brand, category..."
            value={filters.query}
            onChange={event => dispatch(setQuery(event.target.value))}
          />

          <div className="filter-group">
            <h3>Categories</h3>

            {categories.map(category => (
              <label className="check-row" key={category}>
                <input
                  type="checkbox"
                  checked={filters.categories.includes(category)}
                  onChange={() => toggleCategoryFilter(category)}
                />
                <span>
                  {category} ({categoryFacets[category] ?? 0})
                </span>
              </label>
            ))}
          </div>

          <div className="filter-group">
            <h3>Brands</h3>

            {brands.map(brand => (
              <label className="check-row" key={brand}>
                <input
                  type="checkbox"
                  checked={filters.brands.includes(brand)}
                  onChange={() => toggleBrandFilter(brand)}
                />
                <span>
                  {brand} ({brandFacets[brand] ?? 0})
                </span>
              </label>
            ))}
          </div>

          <div className="filter-group">
            <h3>Price range</h3>

            <label htmlFor="min-price">Minimum price</label>
            <input
              id="min-price"
              type="number"
              min="0"
              placeholder="No minimum"
              value={filters.minPrice ?? ''}
              onChange={event =>
                dispatch(
                  setMinPrice(
                    event.target.value === ''
                      ? null
                      : Math.max(0, Number(event.target.value)),
                  ),
                )
              }
            />

            <label htmlFor="max-price">Maximum price</label>
            <input
              id="max-price"
              type="number"
              min="0"
              placeholder="No maximum"
              value={filters.maxPrice ?? ''}
              onChange={event =>
                dispatch(
                  setMaxPrice(
                    event.target.value === ''
                      ? null
                      : Math.max(0, Number(event.target.value)),
                  ),
                )
              }
            />

            {invalidPriceRange && (
              <p className="error" role="alert">
                Minimum price cannot be greater than maximum price.
              </p>
            )}
          </div>

          <div className="filter-group">
            <h3>Minimum rating</h3>
            <select
              value={filters.minRating}
              onChange={event =>
                dispatch(setMinRating(Number(event.target.value)))
              }
            >
              <option value="0">Any rating</option>
              <option value="3">3 stars and up</option>
              <option value="4">4 stars and up</option>
              <option value="4.5">4.5 stars and up</option>
            </select>
          </div>

          <div className="filter-group">
            <h3>Availability</h3>
            <select
              value={filters.availability}
              onChange={event =>
                dispatch(
                  setAvailability(event.target.value as Availability),
                )
              }
            >
              <option value="all">All products</option>
              <option value="in-stock">In stock</option>
              <option value="out-of-stock">Out of stock</option>
            </select>
          </div>
        </aside>

        <section className="results">
          <div className="panel results-toolbar">
            <div>
              <h2>Products</h2>
              <p>
                {allFilteredProducts.length} matching product(s)
              </p>
            </div>

            <div className="toolbar-controls">
              <label htmlFor="sort">Sort by</label>
              <select
                id="sort"
                value={filters.sortBy}
                onChange={event =>
                  dispatch(setSortBy(event.target.value as SortOption))
                }
              >
                <option value="featured">Featured</option>
                <option value="price-asc">Price: Low to high</option>
                <option value="price-desc">Price: High to low</option>
                <option value="rating-desc">Highest rating</option>
                <option value="name-asc">Name: A to Z</option>
              </select>
            </div>
          </div>

          {invalidPriceRange ? (
            <div className="panel empty-state">
              <h3>Invalid price range</h3>
              <p>Adjust the minimum or maximum price to see products.</p>
            </div>
          ) : products.length === 0 ? (
            <div className="panel empty-state">
              <h3>No products found</h3>
              <p>Try changing or resetting your filters.</p>
            </div>
          ) : (
            <div className="product-grid">
              {products.map(product => (
                <article className="panel product-card" key={product.id}>
                  <h3>{product.name}</h3>
                  <p className="product-category">{product.category}</p>
                  <p>Brand: {product.brand}</p>
                  <p className="product-price">${product.price.toFixed(2)}</p>
                  <p>Rating: ⭐ {product.rating.toFixed(1)} / 5</p>
                  <p>
                    {product.stock > 0
                      ? `${product.stock} in stock`
                      : 'Out of stock'}
                  </p>
                </article>
              ))}
            </div>
          )}

          <div className="panel pagination">
            <button
              type="button"
              disabled={filters.page <= 1}
              onClick={() => dispatch(setPage(filters.page - 1))}
            >
              Previous
            </button>

            <span>
              Page {Math.min(filters.page, totalPages)} of {totalPages}
            </span>

            <button
              type="button"
              disabled={filters.page >= totalPages}
              onClick={() => dispatch(setPage(filters.page + 1))}
            >
              Next
            </button>

            <label htmlFor="page-size">Products per page</label>
            <select
              id="page-size"
              value={filters.pageSize}
              onChange={event =>
                dispatch(setPageSize(Number(event.target.value)))
              }
            >
              <option value="3">3</option>
              <option value="6">6</option>
              <option value="9">9</option>
            </select>
          </div>
        </section>
      </div>
    </main>
  );
}
