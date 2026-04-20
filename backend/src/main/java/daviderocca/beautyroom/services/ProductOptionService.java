package daviderocca.beautyroom.services;

import daviderocca.beautyroom.DTO.productDTOs.ProductOptionRequest;
import daviderocca.beautyroom.DTO.productDTOs.ProductOptionResponse;
import daviderocca.beautyroom.entities.Product;
import daviderocca.beautyroom.entities.ProductOption;
import daviderocca.beautyroom.exceptions.ResourceNotFoundException;
import daviderocca.beautyroom.repositories.ProductOptionRepository;
import daviderocca.beautyroom.repositories.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class ProductOptionService {

    private final ProductOptionRepository productOptionRepository;
    private final ProductRepository productRepository;

    @Transactional(readOnly = true)
    public List<ProductOptionResponse> getOptionsByProduct(UUID productId) {
        return productOptionRepository.findByProduct_ProductIdAndActiveTrue(productId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public ProductOptionResponse createOption(UUID productId, ProductOptionRequest req) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException(productId));

        ProductOption option = new ProductOption();
        option.setProduct(product);
        option.setName(req.name());
        option.setOptionGroup(req.optionGroup());
        option.setPrice(req.price());
        option.setStock(req.stock());
        option.setImageUrl(req.imageUrl());
        option.setActive(req.active() == null || req.active());

        ProductOption saved = productOptionRepository.save(option);
        log.info("ProductOption '{}' creata per prodotto {}", saved.getName(), productId);
        return toResponse(saved);
    }

    @Transactional
    public ProductOptionResponse updateOption(UUID optionId, ProductOptionRequest req) {
        ProductOption option = productOptionRepository.findById(optionId)
                .orElseThrow(() -> new ResourceNotFoundException(optionId));

        option.setName(req.name());
        option.setOptionGroup(req.optionGroup());
        option.setPrice(req.price());
        option.setStock(req.stock());
        option.setImageUrl(req.imageUrl());
        if (req.active() != null) {
            option.setActive(req.active());
        }

        ProductOption updated = productOptionRepository.save(option);
        log.info("ProductOption {} aggiornata", optionId);
        return toResponse(updated);
    }

    @Transactional
    public void deleteOption(UUID optionId) {
        ProductOption option = productOptionRepository.findById(optionId)
                .orElseThrow(() -> new ResourceNotFoundException(optionId));
        productOptionRepository.delete(option);
        log.info("ProductOption {} eliminata", optionId);
    }

    private ProductOptionResponse toResponse(ProductOption o) {
        return new ProductOptionResponse(
                o.getProductOptionId(),
                o.getName(),
                o.getOptionGroup(),
                o.getPrice(),
                o.getStock(),
                o.getImageUrl(),
                o.getActive(),
                o.getCreatedAt()
        );
    }
}
