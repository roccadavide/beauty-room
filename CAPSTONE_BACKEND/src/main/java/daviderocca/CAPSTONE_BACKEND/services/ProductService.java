package daviderocca.CAPSTONE_BACKEND.services;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import daviderocca.CAPSTONE_BACKEND.DTO.NewProductDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.ProductResponseDTO;
import daviderocca.CAPSTONE_BACKEND.entities.Category;
import daviderocca.CAPSTONE_BACKEND.entities.Product;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.exceptions.ResourceNotFoundException;
import daviderocca.CAPSTONE_BACKEND.repositories.ProductRepository;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class ProductService {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private CategoryService categoryService;

    @Autowired
    private Cloudinary imageUploader;

    public Page<ProductResponseDTO> findAllProducts(int pageNumber, int pageSize, String sort) {
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(sort));
        Page<Product> page = this.productRepository.findAll(pageable);

        return page.map(product -> new ProductResponseDTO(
                product.getProductId(),
                product.getName(),
                product.getPrice(),
                product.getShortDescription(),
                product.getDescription(),
                product.getImages(),
                product.getStock(),
                product.getCategory() != null ? product.getCategory().getCategoryId() : null
        ));
    }

    public Product findProductById(UUID productId) {
        return this.productRepository.findById(productId).orElseThrow(()-> new ResourceNotFoundException(productId));
    }

    public ProductResponseDTO findProductByIdAndConvert(UUID productId) {
        Product found = this.productRepository.findById(productId).orElseThrow(()-> new ResourceNotFoundException(productId));

        return new ProductResponseDTO(
                found.getProductId(),
                found.getName(),
                found.getPrice(),
                found.getShortDescription(),
                found.getDescription(),
                found.getImages(),
                found.getStock(),
                found.getCategory() != null ? found.getCategory().getCategoryId() : null
        );
    }

    public ProductResponseDTO saveProduct(NewProductDTO payload, MultipartFile image) {

        if (productRepository.existsByName(payload.name())) {
            throw new IllegalArgumentException("Esiste già un prodotto con questo nome!");
        }

        Category relatedCategory = categoryService.findCategoryById(payload.categoryId());

        List<String> images = new ArrayList<>();
        if (image != null && !image.isEmpty()) {
            try {
                String url = (String) imageUploader.uploader()
                        .upload(image.getBytes(), ObjectUtils.emptyMap())
                        .get("url");
                images.add(url);
            } catch (IOException e) {
                throw new BadRequestException("Errore durante l'upload dell'immagine");
            }
        }

        Product newProduct = new Product(payload.name(), payload.price(),payload.shortDescription(), payload.description(), images, payload.stock(), relatedCategory);
        Product savedProduct = productRepository.save(newProduct);



        log.info("Prodotto {} ({} - categoria {}) creato", savedProduct.getProductId(), savedProduct.getName(), relatedCategory.getCategoryId());

        return new ProductResponseDTO(savedProduct.getProductId(), savedProduct.getName(),
                savedProduct.getPrice(),savedProduct.getShortDescription(), savedProduct.getDescription(), savedProduct.getImages(),
                savedProduct.getStock(), relatedCategory.getCategoryId());
    }

    @Transactional
    public ProductResponseDTO findProductByIdAndUpdate(UUID productId, NewProductDTO payload, MultipartFile image) {
        Product found = findProductById(productId);

        if (productRepository.existsByNameAndProductIdNot(payload.name(), productId)) {
            throw new IllegalArgumentException("Esiste già un prodotto con questo nome!");
        }

        Category relatedCategory = categoryService.findCategoryById(payload.categoryId());

        List<String> images = found.getImages();

        if (image != null && !image.isEmpty()) {
            try {
                String url = (String) imageUploader.uploader()
                        .upload(image.getBytes(), ObjectUtils.emptyMap())
                        .get("url");
                images = new ArrayList<>();
                images.add(url);
                found.setImages(images);
            } catch (IOException e) {
                throw new BadRequestException("Errore durante l'upload dell'immagine");
            }
        }

        found.setName(payload.name());
        found.setPrice(payload.price());
        found.setShortDescription(payload.shortDescription());
        found.setDescription(payload.description());
        found.setStock(payload.stock());
        found.setCategory(relatedCategory);

        if (image != null && !image.isEmpty()) {
            found.setImages(images);
        }

        Product modifiedProduct = productRepository.save(found);

        log.info("Prodotto {} aggiornato (categoria: {})", modifiedProduct.getProductId(), relatedCategory.getCategoryKey());

        return new ProductResponseDTO(modifiedProduct.getProductId(), modifiedProduct.getName(),
                modifiedProduct.getPrice(), modifiedProduct.getShortDescription(), modifiedProduct.getDescription(), modifiedProduct.getImages(),
                modifiedProduct.getStock(), relatedCategory.getCategoryId());
    }

    @Transactional
    public void findProductByIdAndDelete(UUID productId) {
        Product found = findProductById(productId);

        if (!found.getOrderItems().isEmpty()) {
            throw new BadRequestException("Non è possibile eliminare un prodotto già ordinato.");
        }

        productRepository.delete(found);
        log.info("Prodotto {} è stato eliminato!", found.getProductId());
    }

}
