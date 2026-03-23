package daviderocca.CAPSTONE_BACKEND.services;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import daviderocca.CAPSTONE_BACKEND.DTO.productDTOs.NewProductDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.productDTOs.ProductResponseDTO;
import daviderocca.CAPSTONE_BACKEND.entities.Category;
import daviderocca.CAPSTONE_BACKEND.entities.Product;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.exceptions.ResourceNotFoundException;
import daviderocca.CAPSTONE_BACKEND.repositories.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;

    private final CategoryService categoryService;

    private final Cloudinary cloudinary;

    // ---------------------------- FIND METHODS ----------------------------

    @Transactional(readOnly = true)
    public Page<ProductResponseDTO> findAllProducts(int pageNumber, int pageSize, String sort) {
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(sort));
        Page<Product> page = productRepository.findAllWithDetails(pageable);
        List<ProductResponseDTO> dtoList = page.getContent().stream().map(this::convertToDTO).toList();
        return new PageImpl<>(dtoList, pageable, page.getTotalElements());
    }

    @Transactional(readOnly = true)
    public Product findProductById(UUID productId) {
        return productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException(productId));
    }

    @Transactional(readOnly = true)
    public ProductResponseDTO findProductByIdAndConvert(UUID productId) {
        Product product = productRepository.findByIdWithDetails(productId)
                .orElseThrow(() -> new ResourceNotFoundException(productId));
        return convertToDTO(product);
    }

    // ---------------------------- CREATE ----------------------------

    @Transactional
    public ProductResponseDTO saveProduct(NewProductDTO payload, List<MultipartFile> images) {
        if (productRepository.existsByName(payload.name())) {
            throw new BadRequestException("Esiste già un prodotto con questo nome!");
        }

        Category relatedCategory = categoryService.findCategoryById(payload.categoryId());
        List<String> imageUrls = uploadImagesIfPresent(images);

        Product newProduct = new Product(
                payload.name(),
                payload.price(),
                payload.shortDescription(),
                payload.description(),
                imageUrls,
                payload.stock(),
                relatedCategory
        );

        Product saved = productRepository.save(newProduct);
        log.info("Prodotto '{}' (ID: {}) creato con categoria '{}'",
                saved.getName(), saved.getProductId(), relatedCategory.getCategoryKey());

        return convertToDTO(saved);
    }

    // ---------------------------- UPDATE ----------------------------

    @Transactional
    public ProductResponseDTO updateProduct(UUID productId, NewProductDTO payload, List<MultipartFile> images) {
        Product found = productRepository.findByIdWithDetails(productId)
                .orElseThrow(() -> new ResourceNotFoundException(productId));

        if (productRepository.existsByNameAndProductIdNot(payload.name(), productId)) {
            throw new BadRequestException("Esiste già un prodotto con questo nome!");
        }

        Category relatedCategory = categoryService.findCategoryById(payload.categoryId());

        // Rimuovi URL segnalate per rimozione
        LinkedHashSet<String> currentImages = new LinkedHashSet<>(found.getImages());
        if (payload.removedImageUrls() != null && !payload.removedImageUrls().isEmpty()) {
            for (String url : payload.removedImageUrls()) {
                currentImages.remove(url);
                // TODO: cancella da Cloudinary (richiede estrazione publicId dall'URL)
                log.info("Immagine rimossa dalla lista del prodotto: {}", url);
            }
        }

        // Aggiungi nuove immagini
        if (images != null && !images.isEmpty()) {
            currentImages.addAll(uploadImagesIfPresent(images));
        }

        found.setImages(currentImages);
        found.setName(payload.name());
        found.setPrice(payload.price());
        found.setShortDescription(payload.shortDescription());
        found.setDescription(payload.description());
        found.setStock(payload.stock());
        found.setCategory(relatedCategory);

        Product updated = productRepository.save(found);
        log.info("Prodotto '{}' (ID: {}) aggiornato correttamente (categoria: {})",
                updated.getName(), updated.getProductId(), relatedCategory.getCategoryKey());

        return convertToDTO(updated);
    }

    // ---------------------------- DELETE ----------------------------

    @Transactional
    public void deleteProduct(UUID productId) {
        Product found = productRepository.findByIdWithDetailsAndOrderItems(productId)
                .orElseThrow(() -> new ResourceNotFoundException(productId));

        if (found.getOrderItems() != null && !found.getOrderItems().isEmpty()) {
            throw new BadRequestException("Non è possibile eliminare un prodotto già ordinato.");
        }

        productRepository.delete(found);
        log.info("Prodotto '{}' (ID: {}) eliminato correttamente.", found.getName(), found.getProductId());
    }

    // ---------------------------- CLOUDINARY ----------------------------
    private List<String> uploadImagesIfPresent(List<MultipartFile> files) {
        List<String> urls = new ArrayList<>();
        if (files == null) return urls;
        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) continue;
            try {
                Map uploadResult = cloudinary.uploader()
                        .upload(file.getBytes(), ObjectUtils.emptyMap());
                String url = (String) uploadResult.get("url");
                urls.add(url);
                log.info("Immagine caricata con successo su Cloudinary: {}", url);
            } catch (IOException e) {
                log.error("Errore durante l'upload dell'immagine su Cloudinary", e);
                throw new BadRequestException("Errore durante l'upload dell'immagine");
            }
        }
        return urls;
    }

    // ---------------------------- CONVERTER ----------------------------
    private ProductResponseDTO convertToDTO(Product product) {
        return new ProductResponseDTO(
                product.getProductId(),
                product.getName(),
                product.getPrice(),
                product.getShortDescription(),
                product.getDescription(),
                new java.util.ArrayList<>(product.getImages()),
                product.getStock(),
                product.getCategory() != null ? product.getCategory().getCategoryId() : null
        );
    }
}