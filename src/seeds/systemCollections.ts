import Collection from '../modules/collection/collection.model';

export const SYSTEM_COLLECTIONS_SEED = [
    {
        name: 'Destacados',
        slug: 'featured',
        type: 'featured',
        isSystem: true,
        showInHomepage: true,
        homepageOrder: 1,
        homepageLayout: 'carousel',
        maxHomepageItems: 8,
    },
    {
        name: 'Nuevos ingresos',
        slug: 'new-arrivals',
        type: 'new_arrivals',
        isSystem: true,
        showInHomepage: true,
        homepageOrder: 2,
        homepageLayout: 'grid',
        maxHomepageItems: 12,
    },
    {
        name: 'Más vendidos',
        slug: 'best-sellers',
        type: 'best_sellers',
        isSystem: true,
        showInHomepage: true,
        homepageOrder: 3,
        homepageLayout: 'carousel',
        maxHomepageItems: 8,
    },
    {
        name: 'En oferta',
        slug: 'on-sale',
        type: 'on_sale',
        isSystem: true,
        showInHomepage: true,
        homepageOrder: 4,
        homepageLayout: 'grid',
        maxHomepageItems: 12,
    },
];

export async function seedSystemCollections() {
    for (const seed of SYSTEM_COLLECTIONS_SEED) {
        await Collection.findOneAndUpdate(
            { slug: seed.slug },
            { $setOnInsert: seed },
            { upsert: true, new: true }
        );
    }
}