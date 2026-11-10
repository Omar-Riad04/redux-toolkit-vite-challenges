
import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type Product = {
  id: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  rating: number;
  stock: number;
};

export type SortOption =
  | 'featured'
  | 'price-asc'
  | 'price-desc'
  | 'rating-desc'
  | 'name-asc';

export type Availability = 'all' | 'in-stock' | 'out-of-stock';

export type CatalogFilters = {
  query: string;
  categories: string[];
  brands: string[];
  minPrice: number | null;
  maxPrice: number | null;
  minRating: number;
  availability: Availability;
  sortBy: SortOption;
  page: number;
  pageSize: number;
};

export type CatalogState = {
  products: Product[];
  filters: CatalogFilters;
};

const initialProducts: Product[] = [
  { id: '1', name: 'Trail Shoes', category: 'Shoes', brand: 'Peak', price: 90, rating: 4.5, stock: 4 },
  { id: '2', name: 'Daypack', category: 'Bags', brand: 'Path', price: 55, rating: 4.2, stock: 0 },
  { id: '3', name: 'Running Shoes', category: 'Shoes', brand: 'Swift', price: 120, rating: 4.8, stock: 8 },
  { id: '4', name: 'Leather Backpack', category: 'Bags', brand: 'Peak', price: 150, rating: 4.6, stock: 3 },
  { id: '5', name: 'Sports Watch', category: 'Accessories', brand: 'Pulse', price: 80, rating: 4.1, stock: 12 },
  { id: '6', name: 'Water Bottle', category: 'Accessories', brand: 'Path', price: 20, rating: 3.9, stock: 0 },
  { id: '7', name: 'Hiking Boots', category: 'Shoes', brand: 'Peak', price: 175, rating: 4.7, stock: 5 },
  { id: '8', name: 'Travel Bag', category: 'Bags', brand: 'Swift', price: 95, rating: 4.3, stock: 6 },
  { id: '9', name: 'Fitness Band', category: 'Accessories', brand: 'Pulse', price: 45, rating: 4.0, stock: 2 },
  { id: '10', name: 'Walking Shoes', category: 'Shoes', brand: 'Path', price: 65, rating: 3.8, stock: 0 },
  { id: '11', name: 'Laptop Backpack', category: 'Bags', brand: 'Peak', price: 110, rating: 4.9, stock: 7 },
  { id: '12', name: 'Smart Watch', category: 'Accessories', brand: 'Swift', price: 190, rating: 4.6, stock: 1 },
];

const defaultFilters: CatalogFilters = {
  query: '',
  categories: [],
  brands: [],
  minPrice: null,
  maxPrice: null,
  minRating: 0,
  availability: 'all',
  sortBy: 'featured',
  page: 1,
  pageSize: 6,
};

const initialState: CatalogState = {
  products: initialProducts,
  filters: defaultFilters,
};

const catalogSlice = createSlice({
  name: 'catalog',
  initialState,
  reducers: {
    setQuery(state, action: PayloadAction<string>) {
      state.filters.query = action.payload;
      state.filters.page = 1;
    },

    toggleCategory(state, action: PayloadAction<string>) {
      const category = action.payload;
      const selected = state.filters.categories;

      state.filters.categories = selected.includes(category)
        ? selected.filter(item => item !== category)
        : [...selected, category];

      state.filters.page = 1;
    },

    toggleBrand(state, action: PayloadAction<string>) {
      const brand = action.payload;
      const selected = state.filters.brands;

      state.filters.brands = selected.includes(brand)
        ? selected.filter(item => item !== brand)
        : [...selected, brand];

      state.filters.page = 1;
    },

    setMinPrice(state, action: PayloadAction<number | null>) {
      state.filters.minPrice = action.payload;
      state.filters.page = 1;
    },

    setMaxPrice(state, action: PayloadAction<number | null>) {
      state.filters.maxPrice = action.payload;
      state.filters.page = 1;
    },

    setMinRating(state, action: PayloadAction<number>) {
      state.filters.minRating = action.payload;
      state.filters.page = 1;
    },

    setAvailability(state, action: PayloadAction<Availability>) {
      state.filters.availability = action.payload;
      state.filters.page = 1;
    },

    setSortBy(state, action: PayloadAction<SortOption>) {
      state.filters.sortBy = action.payload;
      state.filters.page = 1;
    },

    setPage(state, action: PayloadAction<number>) {
      state.filters.page = Math.max(1, action.payload);
    },

    setPageSize(state, action: PayloadAction<number>) {
      state.filters.pageSize = Math.max(1, action.payload);
      state.filters.page = 1;
    },

    setFiltersFromUrl(state, action: PayloadAction<Partial<CatalogFilters>>) {
      state.filters = {
        ...defaultFilters,
        ...action.payload,
        page: Math.max(1, action.payload.page ?? 1),
        pageSize: Math.max(1, action.payload.pageSize ?? defaultFilters.pageSize),
        categories: action.payload.categories ?? [],
        brands: action.payload.brands ?? [],
      };
    },

    resetFilters(state) {
      state.filters = { ...defaultFilters };
    },
  },
});

export const {
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
} = catalogSlice.actions;

export default catalogSlice.reducer;

// ---------- Memoized selectors ----------

type CatalogRootState = {
  catalog: CatalogState;
};

export const selectProducts = (state: CatalogRootState) =>
  state.catalog.products;

export const selectFilters = (state: CatalogRootState) =>
  state.catalog.filters;

const matchesFilters = (
  product: Product,
  filters: CatalogFilters,
  omit?: 'categories' | 'brands',
) => {
  const query = filters.query.trim().toLowerCase();

  if (
    query &&
    !product.name.toLowerCase().includes(query) &&
    !product.brand.toLowerCase().includes(query) &&
    !product.category.toLowerCase().includes(query)
  ) {
    return false;
  }

  if (
    omit !== 'categories' &&
    filters.categories.length > 0 &&
    !filters.categories.includes(product.category)
  ) {
    return false;
  }

  if (
    omit !== 'brands' &&
    filters.brands.length > 0 &&
    !filters.brands.includes(product.brand)
  ) {
    return false;
  }

  if (filters.minPrice !== null && product.price < filters.minPrice) {
    return false;
  }

  if (filters.maxPrice !== null && product.price > filters.maxPrice) {
    return false;
  }

  if (product.rating < filters.minRating) {
    return false;
  }

  if (filters.availability === 'in-stock' && product.stock <= 0) {
    return false;
  }

  if (filters.availability === 'out-of-stock' && product.stock > 0) {
    return false;
  }

  return true;
};

export const selectFilteredProducts = createSelector(
  [selectProducts, selectFilters],
  (products, filters) => {
    // An invalid price range intentionally returns no results.
    if (
      filters.minPrice !== null &&
      filters.maxPrice !== null &&
      filters.minPrice > filters.maxPrice
    ) {
      return [];
    }

    return products.filter(product => matchesFilters(product, filters));
  },
);

export const selectSortedProducts = createSelector(
  [selectFilteredProducts, selectFilters],
  (products, filters) => {
    const sorted = [...products];

    switch (filters.sortBy) {
      case 'price-asc':
        return sorted.sort((a, b) => a.price - b.price);

      case 'price-desc':
        return sorted.sort((a, b) => b.price - a.price);

      case 'rating-desc':
        return sorted.sort((a, b) => b.rating - a.rating);

      case 'name-asc':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));

      default:
        return sorted;
    }
  },
);

export const selectTotalPages = createSelector(
  [selectSortedProducts, selectFilters],
  (products, filters) =>
    Math.max(1, Math.ceil(products.length / filters.pageSize)),
);

export const selectPaginatedProducts = createSelector(
  [selectSortedProducts, selectFilters],
  (products, filters) => {
    const start = (filters.page - 1) * filters.pageSize;
    return products.slice(start, start + filters.pageSize);
  },
);

export const selectCategoryFacets = createSelector(
  [selectProducts, selectFilters],
  (products, filters) => {
    const counts: Record<string, number> = {};

    for (const product of products) {
      if (matchesFilters(product, filters, 'categories')) {
        counts[product.category] = (counts[product.category] ?? 0) + 1;
      }
    }

    return counts;
  },
);

export const selectBrandFacets = createSelector(
  [selectProducts, selectFilters],
  (products, filters) => {
    const counts: Record<string, number> = {};

    for (const product of products) {
      if (matchesFilters(product, filters, 'brands')) {
        counts[product.brand] = (counts[product.brand] ?? 0) + 1;
      }
    }

    return counts;
  },
);
