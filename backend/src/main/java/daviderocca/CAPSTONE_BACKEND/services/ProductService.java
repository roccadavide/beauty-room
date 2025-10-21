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
        Page<Product> page = productRepository.findAll(pageable);
        return page.map(this::convertToDTO);
    }

    @Transactional(readOnly = true)
    public Product findProductById(UUID productId) {
        return productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException(productId));
    }

    @Transactional(readOnly = true)
    public ProductResponseDTO findProductByIdAndConvert(UUID productId) {
        return convertToDTO(findProductById(productId));
    }

    // ---------------------------- CREATE ----------------------------

    @Transactional
    public ProductResponseDTO saveProduct(NewProductDTO payload, MultipartFile image) {
        if (productRepository.existsByName(payload.name())) {
            throw new BadRequestException("Esiste già un prodotto con questo nome!");
        }

        Category relatedCategory = categoryService.findCategoryById(payload.categoryId());
        List<String> images = uploadImageIfPresent(image);

        Product newProduct = new Product(
                payload.name(),
                payload.price(),
                payload.shortDescription(),
                payload.description(),
                images,
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
    public ProductResponseDTO updateProduct(UUID productId, NewProductDTO payload, MultipartFile image) {
        Product found = findProductById(productId);

        if (productRepository.existsByNameAndProductIdNot(payload.name(), productId)) {
            throw new BadRequestException("Esiste già un prodotto con questo nome!");
        }

        Category relatedCategory = categoryService.findCategoryById(payload.categoryId());
        List<String> images = found.getImages();

        // Aggiorna immagine solo se presente nel payload
        if (image != null && !image.isEmpty()) {
            images = uploadImageIfPresent(image);
        }

        found.setName(payload.name());
        found.setPrice(payload.price());
        found.setShortDescription(payload.shortDescription());
        found.setDescription(payload.description());
        found.setStock(payload.stock());
        found.setCategory(relatedCategory);
        found.setImages(images);

        Product updated = productRepository.save(found);
        log.info("Prodotto '{}' (ID: {}) aggiornato correttamente (categoria: {})",
                updated.getName(), updated.getProductId(), relatedCategory.getCategoryKey());

        return convertToDTO(updated);
    }

    // ---------------------------- DELETE ----------------------------

    @Transactional
    public void deleteProduct(UUID productId) {
        Product found = findProductById(productId);

        if (found.getOrderItems() != null && !found.getOrderItems().isEmpty()) {
            throw new BadRequestException("Non è possibile eliminare un prodotto già ordinato.");
        }

        productRepository.delete(found);
        log.info("Prodotto '{}' (ID: {}) eliminato correttamente.", found.getName(), found.getProductId());
    }

    // ---------------------------- CLOUDINARY ----------------------------
    private List<String> uploadImageIfPresent(MultipartFile image) {
        List<String> images = new ArrayList<>();
        if (image != null && !image.isEmpty()) {
            try {
                Map uploadResult = cloudinary.uploader()
                        .upload(image.getBytes(), ObjectUtils.emptyMap());
                images.add((String) uploadResult.get("url"));
                log.info("Immagine caricata con successo su Cloudinary: {}", uploadResult.get("url"));
            } catch (IOException e) {
                log.error("Errore durante l'upload dell'immagine su Cloudinary", e);
                throw new BadRequestException("Errore durante l'upload dell'immagine");
            }
        }
        return images;
    }

    // ---------------------------- CONVERTER ----------------------------
    private ProductResponseDTO convertToDTO(Product product) {
        return new ProductResponseDTO(
                product.getProductId(),
                product.getName(),
                product.getPrice(),
                product.getShortDescription(),
                product.getDescription(),
                product.getImages(),
                product.getStock(),
                product.getCategory() != null ? product.getCategory().getCategoryId() : null
        );
    }
}