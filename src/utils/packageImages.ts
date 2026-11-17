import heroMakkahImg from '../assets/images/hero_makkah_sanctuary_1794804833377.jpg';
import pkgUmrahRegulerImg from '../assets/images/pkg_umrah_reguler_1794804833876.jpg';
import pkgHajiFurodaImg from '../assets/images/pkg_haji_furoda_1794804834522.jpg';
import pkgUmrahTurkiImg from '../assets/images/pkg_umrah_turki_1794804835192.jpg';
import { PackageCategory } from '../types/erp';

const IMAGE_MAP: Record<string, string> = {
    '/src/assets/images/hero_makkah_sanctuary_1794804833377.jpg': heroMakkahImg,
    '/src/assets/images/pkg_umrah_reguler_1794804833876.jpg': pkgUmrahRegulerImg,
    '/src/assets/images/pkg_haji_furoda_1794804834522.jpg': pkgHajiFurodaImg,
    '/src/assets/images/pkg_umrah_turki_1794804835192.jpg': pkgUmrahTurkiImg,
};

export { heroMakkahImg };

export function resolvePackageImage(
    imageUrl?: string,
    category?: PackageCategory
): string {
    if (imageUrl && IMAGE_MAP[imageUrl]) {
        return IMAGE_MAP[imageUrl];
    }
    if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('/assets/'))) {
        return imageUrl;
    }
    if (category === 'HAJI_PLUS' || category === 'FURODA') return pkgHajiFurodaImg;
    if (category === 'WISATA_HALAL') return pkgUmrahTurkiImg;
    return pkgUmrahRegulerImg;
}